import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { RP_ID, RP_NAME, CHALLENGE_TTL_MS } from "@/lib/webauthn/config";

export async function GET() {
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

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID,
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
