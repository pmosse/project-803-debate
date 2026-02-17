"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Tabs } from "@/components/ui/tabs";

export function AssignmentTabs({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentTab = searchParams.get("tab") || "students";

  return (
    <Tabs
      value={currentTab}
      onValueChange={(value) => {
        router.replace(`${pathname}?tab=${value}`, { scroll: false });
      }}
    >
      {children}
    </Tabs>
  );
}
