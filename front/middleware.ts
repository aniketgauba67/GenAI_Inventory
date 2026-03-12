import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

const secret =
  process.env.NEXTAUTH_SECRET ||
  (process.env.NODE_ENV === "production"
    ? undefined
    : "dev-secret-min-32-chars-for-nextauth-jwt");

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
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
  matcher: ["/((?!login|api/auth|_next/static|_next/image|favicon.ico)(?!$).*)"],
};
