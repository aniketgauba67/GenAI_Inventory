import NextAuth, { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

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
        if (
          credentials.username === "admin" &&
          credentials.password === "password"
        ) {
          return {
            id: "1",
            name: "Admin",
            email: "admin@example.com",
            pantryId: credentials.username,
          };
        }
        return null;
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
