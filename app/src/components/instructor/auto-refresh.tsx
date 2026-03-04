"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AutoRefresh({ intervalMs = 30000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const timer = setInterval(() => {
      router.refresh();
    }, intervalMs);
    return () => clearInterval(timer);
  }, [router, intervalMs]);

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => router.refresh()}
      className="gap-1.5"
    >
      <RefreshCw className="h-3.5 w-3.5" />
      Refresh
    </Button>
  );
}
