import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

const secret =
  process.env.NEXTAUTH_SECRET ||
  (process.env.NODE_ENV === "production"
    ? undefined
    : "dev-secret-min-32-chars-for-nextauth-jwt");

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow direct access to static files in /public (e.g. .svg, .png).
  if (pathname.includes(".") && !pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // Keep the homepage chatbot API publicly reachable.
  if (pathname === "/api/chat") {
    return NextResponse.next();
  }

  const token = await getToken({ req, secret });
  if (!token) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", req.url);
    return NextResponse.redirect(loginUrl);
  }

  // Only the director account can access /[pantryId]/dashboard.
  const dashboardPathMatch = pathname.match(/^\/([^/]+)\/dashboard(?:\/.*)?$/);
  const sessionPantryId =
    typeof token.pantryId === "string" ? token.pantryId : undefined;
  if (
    dashboardPathMatch &&
    (dashboardPathMatch[1] !== "director" || sessionPantryId !== "director")
  ) {
    const fallbackUrl = new URL("/", req.url);
    return NextResponse.redirect(fallbackUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!login|api/auth|api/chat|_next/static|_next/image|favicon.ico)(?!$).*)"],
};
