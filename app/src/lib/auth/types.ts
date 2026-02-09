import "next-auth";

declare module "next-auth" {
  interface User {
    role?: string;
    courseCode?: string | null;
  }

  interface Session {
    user: {
      id: string;
      name: string;
      email?: string | null;
      role: string;
      courseCode: string | null;
    };
  }
}
