"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export function SidebarImpersonateButton({
  studentId,
  studentName,
}: {
  studentId: string;
  studentName: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleImpersonate() {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId }),
      });
      if (!res.ok) throw new Error("Failed");
      const { token } = await res.json();

      const result = await signIn("impersonate", {
        studentId,
        token,
        redirect: false,
      });

      if (result?.error) throw new Error("Failed");
      router.push("/dashboard");
    } catch {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleImpersonate}
      disabled={loading}
      className="flex items-center gap-2 rounded-md px-3 py-1.5 text-left text-sm text-white/60 hover:bg-white/10 hover:text-white transition-colors disabled:opacity-50 w-full"
    >
      {loading ? (
        <Loader2 className="h-3 w-3 animate-spin shrink-0" />
      ) : (
        <span className="h-5 w-5 rounded-full bg-white/15 flex items-center justify-center text-[10px] font-medium shrink-0">
          {studentName.charAt(0)}
        </span>
      )}
      <span className="truncate">{studentName}</span>
    </button>
  );
}
