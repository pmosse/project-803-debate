"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Trash2 } from "lucide-react";

export function ResetCaseButton({ assignmentId }: { assignmentId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function handleReset() {
    const res = await fetch(`/api/assignments/${assignmentId}/reset`, {
      method: "POST",
    });
    if (!res.ok) throw new Error("Failed to reset");
    router.refresh();
  }

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className="text-red-600 border-red-200 hover:bg-red-50"
      >
        <Trash2 className="h-4 w-4" />
        Reset Case
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Reset Entire Case"
        description="This will permanently delete all pairings, debate sessions, and evaluations for this assignment. Memos will be reset to their analyzed state. This action cannot be undone."
        confirmLabel="Reset Everything"
        variant="destructive"
        onConfirm={handleReset}
      />
    </>
  );
}
