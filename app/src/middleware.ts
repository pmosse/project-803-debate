import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

function isPrivilegedRole(role: string | undefined): boolean {
  return role === "professor" || role === "super_admin";
}

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;

  // Public routes
  if (
    pathname === "/login" ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/api/signup")
  ) {
    if (isLoggedIn && pathname === "/login") {
      const role = req.auth?.user?.role;
      const dest = isPrivilegedRole(role) ? "/professor/dashboard" : "/dashboard";
      return NextResponse.redirect(new URL(dest, req.url));
    }
    return NextResponse.next();
  }

  // Require auth for everything else
  if (!isLoggedIn) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const role = req.auth?.user?.role;

  // Redirect old /instructor/* URLs → /professor/*
  if (pathname.startsWith("/instructor")) {
    const newPath = pathname.replace("/instructor", "/professor");
    return NextResponse.redirect(new URL(newPath, req.url));
  }

  // Route protection: /professor requires professor or super_admin
  if (pathname.startsWith("/professor") && !isPrivilegedRole(role)) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // Route protection: /admin requires super_admin only
  if (pathname.startsWith("/admin") && role !== "super_admin") {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|logo.svg).*)"],
};
