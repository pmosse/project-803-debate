"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2, UserCheck } from "lucide-react";

export function ImpersonateButton({ studentId, studentName }: { studentId: string; studentName: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleImpersonate() {
    setLoading(true);
    try {
      // Get signed token from instructor-only API
      const res = await fetch("/api/auth/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId }),
      });
      if (!res.ok) throw new Error("Failed to get impersonation token");
      const { token } = await res.json();

      // Sign in as the student
      const result = await signIn("impersonate", {
        studentId,
        token,
        redirect: false,
      });

      if (result?.error) {
        throw new Error("Impersonation failed");
      }

      router.push("/dashboard");
    } catch {
      alert("Failed to impersonate student");
      setLoading(false);
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleImpersonate}
      disabled={loading}
      className="text-xs text-gray-500 hover:text-[#1D4F91]"
      title={`Log in as ${studentName}`}
    >
      {loading ? (
        <>
          <Loader2 className="h-3 w-3 animate-spin" />
          Switching...
        </>
      ) : (
        <>
          <UserCheck className="h-3 w-3" />
          Impersonate
        </>
      )}
    </Button>
  );
}
