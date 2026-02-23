import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { LayoutDashboard, School, GraduationCap, DollarSign } from "lucide-react";
import { SignOutButton } from "@/components/auth/sign-out-button";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");
  if ((session.user as any).role !== "super_admin") redirect("/dashboard");

  return (
    <div className="flex min-h-screen">
      <aside className="relative hidden w-64 bg-[#1a1a2e] text-white md:block">
        <Link
          href="/admin/dashboard"
          className="flex h-16 items-center gap-2.5 border-b border-white/10 px-6 hover:bg-white/5 transition-colors"
        >
          <Image src="/icon.svg" alt="" width={28} height={28} className="rounded-md" />
          <span className="text-lg font-semibold">Admin Panel</span>
        </Link>
        <nav className="flex flex-col gap-1 p-4">
          <Link
            href="/admin/dashboard"
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white transition-colors"
          >
            <LayoutDashboard className="h-4 w-4" />
            Dashboard
          </Link>
          <Link
            href="/admin/classes"
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white transition-colors"
          >
            <School className="h-4 w-4" />
            Classes
          </Link>
          <Link
            href="/admin/professors"
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white transition-colors"
          >
            <GraduationCap className="h-4 w-4" />
            Professors
          </Link>
          <Link
            href="/admin/costs"
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white transition-colors"
          >
            <DollarSign className="h-4 w-4" />
            Costs
          </Link>
          <div className="my-2 border-t border-white/10" />
          <Link
            href="/professor/dashboard"
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-white/50 hover:bg-white/10 hover:text-white transition-colors"
          >
            Professor View
          </Link>
        </nav>
        <div className="absolute bottom-4 left-4 right-4">
          <div className="text-sm text-white/60">{session.user.name}</div>
          <SignOutButton className="mt-1 flex items-center gap-1 text-xs text-white/40 hover:text-white/70 transition-colors" />
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <main className="flex-1 bg-[#F5F7FA] p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
