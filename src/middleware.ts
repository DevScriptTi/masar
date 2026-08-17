import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Next.js Edge Middleware for Role-Based Route Protection & Separation.
 * Enforces rule-based checks on incoming HTTP requests.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Retrieve user role & session token from cookies if available
  const userRole = request.cookies.get("user_role")?.value || "";

  // Rule 1: Protect Admin Routes (/admin, /admin/...)
  if (pathname.startsWith("/admin")) {
    if (userRole && userRole.toLowerCase() !== "admin") {
      const dashboardUrl = new URL("/dashboard", request.url);
      return NextResponse.redirect(dashboardUrl);
    }
  }

  // Rule 2: Protect Student Area (/dashboard, /dashboard/...)
  if (pathname.startsWith("/dashboard")) {
    if (userRole && userRole.toLowerCase() === "admin") {
      const adminDashboardUrl = new URL("/admin/dashboard", request.url);
      return NextResponse.redirect(adminDashboardUrl);
    }
  }

  // Rule 3: Auth Redirect on Root Landing Page (/)
  if (pathname === "/") {
    if (userRole) {
      if (userRole.toLowerCase() === "admin") {
        return NextResponse.redirect(new URL("/admin/dashboard", request.url));
      } else if (userRole.toLowerCase() === "student") {
        return NextResponse.redirect(new URL("/dashboard", request.url));
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/admin/:path*", "/dashboard/:path*"],
};
