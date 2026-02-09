import { Badge } from "@/components/ui/badge";
import type { SlaStatus } from "@/types/claim";

const slaConfig: Record<SlaStatus, { className: string }> = {
  OK: { className: "bg-green-100 text-green-700 hover:bg-green-100" },
  WARNING: { className: "bg-yellow-100 text-yellow-700 hover:bg-yellow-100" },
  BREACHED: { className: "bg-red-100 text-red-700 hover:bg-red-100" },
  N_A: { className: "bg-gray-100 text-gray-500 hover:bg-gray-100" },
};

export function SlaBadge({ status, label }: { status: SlaStatus; label: string }) {
  const config = slaConfig[status] ?? slaConfig.N_A;
  return (
    <Badge variant="secondary" className={config.className}>
      {label}
    </Badge>
  );
}
