import { Badge } from "@/components/ui/badge";
import type { PriorityLevel } from "@/types/claim";

const priorityConfig: Record<PriorityLevel, { label: string; className: string }> = {
  CRITICAL: { label: "Critical", className: "bg-red-100 text-red-700 hover:bg-red-100" },
  HIGH: { label: "High", className: "bg-orange-100 text-orange-700 hover:bg-orange-100" },
  MEDIUM: { label: "Medium", className: "bg-yellow-100 text-yellow-700 hover:bg-yellow-100" },
  LOW: { label: "Low", className: "bg-green-100 text-green-700 hover:bg-green-100" },
};

export function PriorityBadge({ priority }: { priority: PriorityLevel }) {
  const config = priorityConfig[priority] ?? priorityConfig.LOW;
  return (
    <Badge variant="secondary" className={config.className}>
      {config.label}
    </Badge>
  );
}
