/******************************** route.ts ***************************************
 *
 *  Module: Frontend API Route
 *
 *  This module proxies frontend requests to backend services and
 *  authentication handlers.
 *
 *  The module provides:
 *
 *  - Next.js route handlers for browser requests.
 *  - backend API forwarding with consistent response handling.
 *
 *  Key Structures Used:
 *
 *  - Next.js route modules, request objects, and response payloads.
 *
 *  This module ensures:
 *
 *  - frontend calls stay behind a stable local API path.
 *  - backend errors are surfaced in a predictable shape.
 *
 *  Editors: Aniket, Dipankar, Liam, Jin, and Philip.
 *
 *****************************************************************************/
import NextAuth, { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

const apiBase =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.API_URL ||
  "http://localhost:8000";

const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      id: "credentials",
      name: "Pantry Credentials",
      credentials: {
        username: { label: "Pantry ID", type: "text", placeholder: "pantry1234" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null;

        try {
          const response = await fetch(`${apiBase}/auth/login`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              username: credentials.username,
              password: credentials.password,
            }),
            cache: "no-store",
          });

          if (!response.ok) {
            return null;
          }

          const data = (await response.json()) as {
            ok?: boolean;
            user?: {
              id: string;
              name: string;
              email?: string | null;
              pantryId: string;
              role?: string;
            };
          };

          if (!data.ok || !data.user) {
            return null;
          }

          return {
            id: data.user.id,
            name: data.user.name,
            email: data.user.email ?? undefined,
            pantryId: data.user.pantryId,
            role: data.user.role ?? "pantry",
          };
        } catch {
          return null;
        }
      },
    }),
  ],

  session: {
    strategy: "jwt",
  },

  pages: {
    signIn: "/login",
  },

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.pantryId = (user as { pantryId?: string }).pantryId;
        token.role = (user as { role?: string }).role;
      } else if (!token.role && token.pantryId) {
        token.role = token.pantryId === "director" ? "director" : "pantry";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id = token.id as string;
        (session.user as { pantryId?: string }).pantryId = token.pantryId as string;
        const pantryId = token.pantryId as string;
        const inferredRole = pantryId === "director" ? "director" : "pantry";
        (session.user as { role?: string }).role = (token.role as string) || inferredRole;
      }
      return session;
    },
  },

  secret: (() => {
    if (process.env.NEXTAUTH_SECRET) return process.env.NEXTAUTH_SECRET;
    if (process.env.NODE_ENV === "production")
      throw new Error("NEXTAUTH_SECRET environment variable is required in production");
    return "dev-secret-min-32-chars-for-nextauth-jwt";
  })(),
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
