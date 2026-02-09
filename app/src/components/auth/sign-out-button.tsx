"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";

export function SignOutButton({ className }: { className?: string }) {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      className={className || "flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"}
    >
      <LogOut className="h-3.5 w-3.5" />
      Sign out
    </button>
  );
}
