import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { LayoutDashboard, Mic, PlusCircle, Users } from "lucide-react";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { MobileSidebar } from "@/components/instructor/mobile-sidebar";

const NAV_LINKS = [
  { href: "/instructor/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/instructor/students", label: "Students", icon: "users" },
  { href: "/instructor/assignments/new", label: "New Assignment", icon: "plus" },
] as const;

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
      {/* Desktop sidebar */}
      <aside className="relative hidden w-64 bg-[#0F2B4C] text-white md:block">
        <Link href="/instructor/dashboard" className="flex h-16 items-center gap-2.5 border-b border-white/10 px-6 hover:bg-white/5 transition-colors">
          <Image src="/icon.svg" alt="" width={28} height={28} className="rounded-md" />
          <span className="text-lg font-semibold">Project 803</span>
        </Link>
        <nav className="flex flex-col gap-1 p-4">
          <Link
            href="/instructor/dashboard"
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white transition-colors"
          >
            <LayoutDashboard className="h-4 w-4" />
            Dashboard
          </Link>
          <Link
            href="/instructor/students"
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white transition-colors"
          >
            <Users className="h-4 w-4" />
            Students
          </Link>
          <Link
            href="/instructor/assignments/new"
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white transition-colors"
          >
            <PlusCircle className="h-4 w-4" />
            New Assignment
          </Link>
          <Link
            href="/instructor/av-test"
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white transition-colors"
          >
            <Mic className="h-4 w-4" />
            A/V Test
          </Link>
        </nav>
        <div className="absolute bottom-4 left-4 right-4">
          <div className="text-sm text-white/60">{session.user.name}</div>
          <SignOutButton className="mt-1 flex items-center gap-1 text-xs text-white/40 hover:text-white/70 transition-colors" />
        </div>
      </aside>

      {/* Mobile header + sidebar */}
      <div className="flex flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b bg-[#0F2B4C] px-4 md:hidden">
          <Link href="/instructor/dashboard" className="flex items-center gap-2">
            <Image src="/icon.svg" alt="" width={24} height={24} className="rounded-md" />
            <span className="text-sm font-semibold text-white">Project 803</span>
          </Link>
          <MobileSidebar userName={session.user.name || ""} />
        </header>

        <main className="flex-1 bg-[#F5F7FA] p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
