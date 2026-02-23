"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X, LayoutDashboard, Users, PlusCircle, Mic, DollarSign, LogOut } from "lucide-react";
import { signOut } from "next-auth/react";

export function MobileSidebar({ userName }: { userName: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-md p-1.5 text-white/80 hover:bg-white/10"
      >
        <Menu className="h-5 w-5" />
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/50"
            onClick={() => setOpen(false)}
          />

          {/* Panel */}
          <div className="fixed inset-y-0 right-0 z-50 w-64 bg-[#0F2B4C] p-4 shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <span className="text-sm font-semibold text-white">Menu</span>
              <button
                onClick={() => setOpen(false)}
                className="rounded-md p-1 text-white/60 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className="flex flex-col gap-1">
              <Link
                href="/professor/dashboard"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white"
              >
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </Link>
              <Link
                href="/professor/students"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white"
              >
                <Users className="h-4 w-4" />
                Students
              </Link>
              <Link
                href="/professor/assignments/new"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white"
              >
                <PlusCircle className="h-4 w-4" />
                New Assignment
              </Link>
              <Link
                href="/professor/costs"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white"
              >
                <DollarSign className="h-4 w-4" />
                Costs
              </Link>
              <Link
                href="/professor/av-test"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white"
              >
                <Mic className="h-4 w-4" />
                A/V Test
              </Link>
            </nav>

            <div className="absolute bottom-4 left-4 right-4">
              <div className="text-sm text-white/60">{userName}</div>
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="mt-1 flex items-center gap-1 text-xs text-white/40 hover:text-white/70"
              >
                <LogOut className="h-3 w-3" />
                Sign out
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
