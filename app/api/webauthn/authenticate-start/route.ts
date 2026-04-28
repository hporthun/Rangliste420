import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { getWebAuthnRP, CHALLENGE_TTL_MS } from "@/lib/webauthn/config";

export async function GET(req: NextRequest) {
  const { rpID } = await getWebAuthnRP(req.headers);
  const options = await generateAuthenticationOptions({
    rpID,
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
