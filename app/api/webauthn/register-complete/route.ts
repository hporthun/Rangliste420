import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import { getWebAuthnRP } from "@/lib/webauthn/config";
import { logAudit, getIp, A } from "@/lib/security/audit";
import { z } from "zod";

const schema = z.object({
  response: z.unknown(),
  name: z.string().min(1).max(60).default("Passkey"),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  const { response, name } = parsed.data;

  // Find pending challenge for this user
  const challengeRecord = await db.webAuthnChallenge.findFirst({
    where: {
      type: "register",
      userId: session.user.id,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });
  if (!challengeRecord) {
    return NextResponse.json({ error: "Challenge not found or expired" }, { status: 400 });
  }

  const { rpID, origin } = await getWebAuthnRP(req.headers);
  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: response as Parameters<typeof verifyRegistrationResponse>[0]["response"],
      expectedChallenge: challengeRecord.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }

  // Clean up challenge
  await db.webAuthnChallenge.delete({ where: { id: challengeRecord.id } });

  if (!verification.verified || !verification.registrationInfo) {
    return NextResponse.json({ error: "Verification failed" }, { status: 400 });
  }

  // @simplewebauthn/server v11+ wraps credential fields in a sub-object;
  // credential.id is now Base64URLString, credential.publicKey stays Uint8Array.
  const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;

  await db.webAuthnCredential.create({
    data: {
      userId: session.user.id,
      credentialId: credential.id,
      publicKey: Buffer.from(credential.publicKey).toString("base64url"),
      counter: BigInt(credential.counter),
      deviceType: credentialDeviceType ?? "singleDevice",
      backedUp: credentialBackedUp ?? false,
      transports: JSON.stringify(credential.transports ?? []),
      name,
    },
  });

  await logAudit({ userId: session.user.id, action: A.PASSKEY_ADDED, detail: name, ip: getIp(req.headers) });

  return NextResponse.json({ verified: true });
}
