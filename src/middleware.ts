import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Next.js Edge Middleware for Role-Based Route Protection & Strict Routing.
 * Enforces strict, mutually exclusive routing paths for all roles while allowing shared routes (/settings).
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip static assets, favicon, and API routes
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Retrieve user role from cookie
  const rawRole = request.cookies.get("user_role")?.value || "";
  const userRole = rawRole.toLowerCase().trim();

  // Route classifications
  const isSettingsPath = pathname.startsWith("/settings");
  const isProtectedPath =
    pathname.startsWith("/super-admin") ||
    pathname.startsWith("/teacher") ||
    pathname.startsWith("/dashboard");

  // 1. Unauthenticated -> Redirect to /login
  if (!userRole) {
    if (isProtectedPath || isSettingsPath) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return NextResponse.next();
  }

  // Allow /settings for all authenticated users
  if (isSettingsPath) {
    return NextResponse.next();
  }

  // 2. Role: super_admin -> Allowed in /super-admin & /settings
  if (userRole === "super_admin") {
    if (!pathname.startsWith("/super-admin")) {
      return NextResponse.redirect(new URL("/super-admin", request.url));
    }
  }

  // 3. Role: teacher (or admin) -> Allowed in /teacher/* & /settings
  else if (userRole === "teacher" || userRole === "admin") {
    if (!pathname.startsWith("/teacher")) {
      return NextResponse.redirect(new URL("/teacher/dashboard", request.url));
    }
  }

  // 4. Role: student -> Allowed in /dashboard/* & /settings
  else if (userRole === "student") {
    if (!pathname.startsWith("/dashboard")) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
