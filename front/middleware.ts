// Middleware to protect routes — redirects unauthenticated users to /login
import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  // If no token (not authenticated), redirect to the login page
  if (!token) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", req.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Protect all routes EXCEPT: home (/), /login, /api/auth/*, and static assets
  matcher: ["/((?!login|api/auth|_next/static|_next/image|favicon.ico)(?!$).*)"],
};
