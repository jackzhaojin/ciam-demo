import { auth } from "./auth";

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Allow public routes
  if (
    pathname === "/" ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  ) {
    return;
  }

  // Check authentication for protected routes
  if (!req.auth) {
    const signInUrl = new URL("/", req.url);
    signInUrl.searchParams.set("callbackUrl", pathname);
    return Response.redirect(signInUrl);
  }

  // Handle expired sessions
  if (req.auth.error === "RefreshAccessTokenError") {
    const signInUrl = new URL("/", req.url);
    signInUrl.searchParams.set("error", "session_expired");
    return Response.redirect(signInUrl);
  }
});

export const config = {
  matcher: ["/dashboard/:path*", "/claims/:path*", "/admin/:path*", "/profile/:path*", "/dev/:path*"],
};
