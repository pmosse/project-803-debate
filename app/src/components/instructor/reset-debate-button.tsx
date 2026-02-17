"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { RotateCcw } from "lucide-react";

export function ResetDebateButton({ pairingId }: { pairingId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function handleReset() {
    const res = await fetch(`/api/debates/${pairingId}/reset-evaluation`, {
      method: "POST",
    });
    if (!res.ok) throw new Error("Failed to reset");
    router.refresh();
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="text-xs text-orange-600 border-orange-200 hover:bg-orange-50"
      >
        <RotateCcw className="h-3 w-3" />
        Reset Debate
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Reset Debate"
        description="This will delete all evaluations and reset the debate session back to its initial state. The pairing will be preserved but students will need to debate again."
        confirmLabel="Reset Debate"
        variant="warning"
        onConfirm={handleReset}
      />
    </>
  );
}
