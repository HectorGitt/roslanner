import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

/**
 * Optimistic route protection: checks for the session cookie only
 * (real verification happens in API routes / server components).
 */
export default function proxy(request: NextRequest) {
  const sessionCookie = getSessionCookie(request);
  const { pathname } = request.nextUrl;

  const isAuthPage = pathname === "/login" || pathname === "/signup";

  if (!sessionCookie && !isAuthPage) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (sessionCookie && isAuthPage) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/wards/:path*",
    "/roles/:path*",
    "/tiers/:path*",
    "/leave/:path*",
    "/rosters/:path*",
    "/settings/:path*",
    "/onboarding",
    "/login",
    "/signup",
  ],
};
