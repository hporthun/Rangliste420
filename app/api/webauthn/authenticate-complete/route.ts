import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { getWebAuthnRP, PASSKEY_SESSION_TTL_MS } from "@/lib/webauthn/config";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  // Find the most recent authenticate challenge
  const challengeRecord = await db.webAuthnChallenge.findFirst({
    where: {
      type: "authenticate",
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });
  if (!challengeRecord) {
    return NextResponse.json({ error: "Challenge not found or expired" }, { status: 400 });
  }

  // Find the credential by ID from the response
  const credentialId: string = body.id ?? body.rawId;
  const storedCredential = await db.webAuthnCredential.findUnique({
    where: { credentialId },
    include: { user: true },
  });
  if (!storedCredential) {
    return NextResponse.json({ error: "Credential not found" }, { status: 400 });
  }

  const { rpID, origin } = await getWebAuthnRP(req.headers);
  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: body,
      expectedChallenge: challengeRecord.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      // @simplewebauthn/server v11+ renamed 'authenticator' → 'credential';
      // id is Base64URLString (kein Uint8Array-Convert mehr), publicKey bleibt Uint8Array.
      credential: {
        id: storedCredential.credentialId,
        publicKey: new Uint8Array(Buffer.from(storedCredential.publicKey, "base64url")),
        counter: Number(storedCredential.counter),
        transports: JSON.parse(storedCredential.transports) as AuthenticatorTransport[],
      },
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }

  // Clean up challenge
  await db.webAuthnChallenge.delete({ where: { id: challengeRecord.id } });

  if (!verification.verified) {
    return NextResponse.json({ error: "Verification failed" }, { status: 401 });
  }

  // Update counter and lastUsed
  await db.webAuthnCredential.update({
    where: { id: storedCredential.id },
    data: {
      counter: BigInt(verification.authenticationInfo.newCounter),
      lastUsed: new Date(),
    },
  });

  // Issue a single-use passkey session token (60-second TTL)
  const passkeyToken = crypto.randomBytes(32).toString("base64url");
  await db.webAuthnChallenge.create({
    data: {
      type: "passkey-session",
      challenge: passkeyToken,
      userId: storedCredential.userId,
      expiresAt: new Date(Date.now() + PASSKEY_SESSION_TTL_MS),
    },
  });

  return NextResponse.json({ passkeyToken });
}
