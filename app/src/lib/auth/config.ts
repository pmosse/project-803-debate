import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import crypto from "crypto";

export function generateImpersonateToken(studentId: string): string {
  const secret = process.env.NEXTAUTH_SECRET || "dev-secret";
  return crypto.createHmac("sha256", secret).update(studentId).digest("hex");
}

export const authConfig: NextAuthConfig = {
  providers: [
    Credentials({
      id: "unified-login",
      name: "Login",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email as string;
        const password = credentials?.password as string;
        if (!email || !password) return null;

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, email))
          .limit(1);

        if (!user || !user.passwordHash) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          courseCode: user.courseCode,
        };
      },
    }),
    Credentials({
      id: "impersonate",
      name: "Impersonate",
      credentials: {
        studentId: { type: "text" },
        token: { type: "text" },
      },
      async authorize(credentials) {
        const studentId = credentials?.studentId as string;
        const token = credentials?.token as string;
        if (!studentId || !token) return null;

        const expected = generateImpersonateToken(studentId);
        if (token !== expected) return null;

        const [student] = await db
          .select()
          .from(users)
          .where(eq(users.id, studentId))
          .limit(1);

        if (!student || student.role !== "student") return null;

        return {
          id: student.id,
          name: student.name,
          email: student.email,
          role: student.role,
          courseCode: student.courseCode,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
        token.courseCode = (user as any).courseCode;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        (session.user as any).role = token.role;
        (session.user as any).courseCode = token.courseCode;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
};
