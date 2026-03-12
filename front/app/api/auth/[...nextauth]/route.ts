import NextAuth, { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

const apiBase =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.API_URL ||
  "http://localhost:8000";

export const authOptions: NextAuthOptions = {
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
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id = token.id as string;
        (session.user as { pantryId?: string }).pantryId = token.pantryId as string;
      }
      return session;
    },
  },

  secret:
    process.env.NEXTAUTH_SECRET ||
    (process.env.NODE_ENV === "production"
      ? undefined
      : "dev-secret-min-32-chars-for-nextauth-jwt"),
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
