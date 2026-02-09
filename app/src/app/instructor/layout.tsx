import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { BookOpen, LayoutDashboard, PlusCircle } from "lucide-react";
import { SignOutButton } from "@/components/auth/sign-out-button";

export default async function InstructorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");
  if ((session.user as any).role !== "instructor") redirect("/dashboard");

  return (
    <div className="flex min-h-screen">
      <aside className="relative w-64 bg-[#0F2B4C] text-white">
        <div className="flex h-16 items-center gap-2 border-b border-white/10 px-6">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15">
            <BookOpen className="h-4 w-4 text-white" />
          </div>
          <span className="text-lg font-semibold">Project 803</span>
        </div>
        <nav className="flex flex-col gap-1 p-4">
          <Link
            href="/instructor/dashboard"
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white transition-colors"
          >
            <LayoutDashboard className="h-4 w-4" />
            Dashboard
          </Link>
          <Link
            href="/instructor/assignments/new"
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white transition-colors"
          >
            <PlusCircle className="h-4 w-4" />
            New Assignment
          </Link>
        </nav>
        <div className="absolute bottom-4 left-4 right-4">
          <div className="text-sm text-white/60">{session.user.name}</div>
          <SignOutButton className="mt-1 flex items-center gap-1 text-xs text-white/40 hover:text-white/70 transition-colors" />
        </div>
      </aside>
      <main className="flex-1 bg-[#F5F7FA] p-8">{children}</main>
    </div>
  );
}
