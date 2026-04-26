import { handlers } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Intercept GET /api/auth/signin before Auth.js renders its built-in page.
 *
 * @auth/core's built-in signin page contains a <script dangerouslySetInnerHTML>
 * that React 19 warns about ("Encountered a script tag while rendering React
 * component") during client-side hydration. Because we have a fully custom
 * login page at /auth/login (configured via pages.signIn), we never need the
 * built-in page — redirect immediately instead.
 *
 * All other /api/auth/* routes (session, csrf, callback, signout …) pass
 * through to the standard Auth.js handler unchanged.
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ nextauth: string[] }> },
) {
  const { nextauth } = await ctx.params;

  if (nextauth.length === 1 && nextauth[0] === "signin") {
    const url = new URL(req.url);
    const callbackUrl = url.searchParams.get("callbackUrl") ?? "/admin";
    return NextResponse.redirect(
      new URL(
        `/auth/login?callbackUrl=${encodeURIComponent(callbackUrl)}`,
        url.origin,
      ),
    );
  }

  return handlers.GET(req);
}

export const { POST } = handlers;
