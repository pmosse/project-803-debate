import { Badge } from "./badge";

const statusConfig: Record<string, { label: string; variant: "default" | "success" | "warning" | "error" | "secondary" }> = {
  not_started: { label: "Not Started", variant: "secondary" },
  uploaded: { label: "Memo Uploaded", variant: "default" },
  extracting: { label: "Processing", variant: "warning" },
  analyzing: { label: "Analyzing", variant: "warning" },
  analyzed: { label: "Analyzed", variant: "success" },
  error: { label: "Error", variant: "error" },
  paired: { label: "Paired", variant: "default" },
  invited: { label: "Debate Scheduled", variant: "default" },
  in_progress: { label: "In Progress", variant: "warning" },
  completed: { label: "Completed", variant: "success" },
  no_show: { label: "No Show", variant: "error" },
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] || { label: status, variant: "secondary" as const };
  return (
    <Badge variant={config.variant} className={className}>
      {config.label}
    </Badge>
  );
}
