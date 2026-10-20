import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public paths that do not require authentication
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/init") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.startsWith("/data") ||
    pathname.endsWith(".csv")
  ) {
    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get("fa_session")?.value;

  // If user is accessing protected API paths without a session, return 401
  if (!sessionCookie && (pathname.startsWith("/api/projects") || pathname.startsWith("/api/runs"))) {
    return NextResponse.json(
      { success: false, error: { message: "Unauthorized. Please log in or use a demo account." } },
      { status: 401 }
    );
  }

  // If user is accessing protected app pages without a session, redirect to login
  if (!sessionCookie && (pathname === "/" || pathname.startsWith("/projects"))) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
