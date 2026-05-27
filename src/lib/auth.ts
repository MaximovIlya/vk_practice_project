import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: Role;
      needsRoleSelection?: boolean;
    };
  }
  interface User {
    role: Role;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: Role;
    needsRoleSelection?: boolean;
  }
}

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });
        if (!user || !user.password) return null;

        const valid = await bcrypt.compare(credentials.password, user.password);
        if (!valid) return null;

        return { id: user.id, email: user.email, name: user.name, role: user.role };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, account, profile, trigger }) {
      if (account?.provider === "google" && profile) {
        const p = profile as { sub: string; email: string; name: string };
        let dbUser = await prisma.user.findFirst({
          where: { OR: [{ googleId: p.sub }, { email: p.email }] },
        });
        let isNew = false;
        if (!dbUser) {
          isNew = true;
          dbUser = await prisma.user.create({
            data: { email: p.email, name: p.name, googleId: p.sub, role: "PARTICIPANT" },
          });
        } else if (!dbUser.googleId) {
          dbUser = await prisma.user.update({
            where: { id: dbUser.id },
            data: { googleId: p.sub },
          });
        }
        token.id = dbUser.id;
        token.role = dbUser.role;
        token.needsRoleSelection = isNew;
      } else if (user) {
        token.id = user.id;
        token.role = user.role;
      }

      if (trigger === "update") {
        const dbUser = await prisma.user.findUnique({ where: { id: token.id } });
        if (dbUser) {
          token.role = dbUser.role;
          token.needsRoleSelection = false;
        }
      }

      return token;
    },
    session({ session, token }) {
      session.user.id = token.id;
      session.user.role = token.role;
      session.user.needsRoleSelection = token.needsRoleSelection;
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
};
