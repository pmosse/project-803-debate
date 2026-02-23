"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

const STATUS_LABELS: Record<string, string> = {
  uploaded: "Waiting to process...",
  extracting: "Extracting text from your memo...",
  analyzing: "AI is analyzing your memo...",
};

export function MemoProcessingStatus({ status }: { status: string }) {
  const router = useRouter();

  useEffect(() => {
    const interval = setInterval(() => {
      router.refresh();
    }, 3000);
    return () => clearInterval(interval);
  }, [router]);

  return (
    <div className="flex items-center gap-3 py-2">
      <Loader2 className="h-5 w-5 animate-spin text-[#1D4F91]" />
      <p className="text-sm text-gray-600">
        {STATUS_LABELS[status] || "Processing your memo..."}
      </p>
    </div>
  );
}
