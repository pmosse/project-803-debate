"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Flag } from "lucide-react";

interface PositionConfirmationProps {
  memoId: string;
  position: string;
  thesis: string;
}

export function PositionConfirmation({
  memoId,
  position,
  thesis,
}: PositionConfirmationProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const positionLabel =
    position === "net_positive"
      ? "Net Positive on Walmart"
      : position === "net_negative"
        ? "Net Negative on Walmart"
        : "Unclassified";

  async function handleConfirm() {
    setLoading(true);
    await fetch(`/api/memos/${memoId}/confirm`, { method: "POST" });
    router.refresh();
  }

  async function handleFlag() {
    setLoading(true);
    await fetch(`/api/memos/${memoId}/flag`, { method: "POST" });
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md bg-[#E8F4FD] p-4">
        <p className="text-sm text-gray-700">
          We identified your position as:
        </p>
        <p className="mt-1 text-lg font-semibold text-[#1D4F91]">
          {positionLabel}
        </p>
        <p className="mt-2 text-sm text-gray-600 italic">&ldquo;{thesis}&rdquo;</p>
      </div>
      <p className="text-sm text-gray-600">Is this correct?</p>
      <div className="flex gap-3">
        <Button onClick={handleConfirm} disabled={loading}>
          <CheckCircle className="h-4 w-4" />
          Yes, that&apos;s correct
        </Button>
        <Button variant="outline" onClick={handleFlag} disabled={loading}>
          <Flag className="h-4 w-4" />
          No, flag for review
        </Button>
      </div>
    </div>
  );
}
