import "next-auth";

declare module "next-auth" {
  interface User {
    role?: "student" | "professor" | "super_admin";
    courseCode?: string | null;
  }

  interface Session {
    user: {
      id: string;
      name: string;
      email?: string | null;
      role: "student" | "professor" | "super_admin";
      courseCode: string | null;
    };
  }
}
