import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SignOutButton } from "@/components/auth/sign-out-button";
import Link from "next/link";
import Image from "next/image";

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <div className="min-h-screen bg-[#F5F7FA]">
      <header className="bg-[#1D4F91] shadow-sm">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <Image src="/icon.svg" alt="" width={28} height={28} className="rounded-md" />
            <span className="text-base font-semibold text-white">
              Project 803
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-sm text-white/70">{session.user.name}</span>
            <SignOutButton className="flex items-center gap-1 text-sm text-white/50 hover:text-white/80 transition-colors" />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
