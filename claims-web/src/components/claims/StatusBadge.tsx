import { Badge } from "@/components/ui/badge";
import type { ClaimStatus } from "@/types/claim";

const statusConfig: Record<ClaimStatus, { label: string; variant: string; className: string }> = {
  DRAFT: { label: "Draft", variant: "secondary", className: "bg-gray-100 text-gray-700 hover:bg-gray-100" },
  SUBMITTED: { label: "Submitted", variant: "default", className: "bg-blue-100 text-blue-700 hover:bg-blue-100" },
  UNDER_REVIEW: { label: "Under Review", variant: "default", className: "bg-yellow-100 text-yellow-700 hover:bg-yellow-100" },
  APPROVED: { label: "Approved", variant: "default", className: "bg-green-100 text-green-700 hover:bg-green-100" },
  DENIED: { label: "Denied", variant: "destructive", className: "bg-red-100 text-red-700 hover:bg-red-100" },
  CLOSED: { label: "Closed", variant: "secondary", className: "bg-gray-100 text-gray-500 hover:bg-gray-100" },
};

export function StatusBadge({ status }: { status: ClaimStatus }) {
  const config = statusConfig[status] ?? statusConfig.DRAFT;
  return (
    <Badge variant="secondary" className={config.className}>
      {config.label}
    </Badge>
  );
}
