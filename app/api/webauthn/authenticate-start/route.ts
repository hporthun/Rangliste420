import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { RP_ID, CHALLENGE_TTL_MS } from "@/lib/webauthn/config";

export async function GET() {
  const options = await generateAuthenticationOptions({
    rpID: RP_ID,
    userVerification: "preferred",
    // No allowCredentials → discoverable credential (passkey) flow
  });

  await db.webAuthnChallenge.create({
    data: {
      type: "authenticate",
      challenge: options.challenge,
      expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
    },
  });

  return NextResponse.json(options);
}
