import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const isAdminRoute = req.nextUrl.pathname.startsWith("/admin");
  const isApiAdminRoute = req.nextUrl.pathname.startsWith("/api/admin");
  const isAuthRoute = req.nextUrl.pathname.startsWith("/auth");

  if ((isAdminRoute || isApiAdminRoute) && !req.auth) {
    const loginUrl = new URL("/auth/login", req.url);
    loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Allow forgot/reset routes regardless of auth state
  const isResetRoute =
    req.nextUrl.pathname.startsWith("/auth/forgot") ||
    req.nextUrl.pathname.startsWith("/auth/reset");

  if (isAuthRoute && !isResetRoute && req.auth) {
    return NextResponse.redirect(new URL("/admin", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*", "/auth/:path*"],
};
