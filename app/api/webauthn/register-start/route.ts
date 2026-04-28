import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { getWebAuthnRP, CHALLENGE_TTL_MS } from "@/lib/webauthn/config";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    include: { webAuthnCredentials: true },
  });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const existingCredentials = user.webAuthnCredentials.map((c) => ({
    id: new Uint8Array(Buffer.from(c.credentialId, "base64url")),
    type: "public-key" as const,
    transports: JSON.parse(c.transports) as AuthenticatorTransport[],
  }));

  const { rpID, rpName } = await getWebAuthnRP(req.headers);
  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userID: user.id,
    userName: user.username ?? user.email ?? user.id,
    userDisplayName: user.username ?? user.email ?? "Admin",
    attestationType: "none",
    excludeCredentials: existingCredentials,
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
  });

  // Store challenge
  await db.webAuthnChallenge.create({
    data: {
      type: "register",
      challenge: options.challenge,
      userId: user.id,
      expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
    },
  });

  return NextResponse.json(options);
}
