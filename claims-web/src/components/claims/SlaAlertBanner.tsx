import type { Claim } from "@/types/claim";
import { computeSla } from "@/lib/sla";
import { AlertTriangle } from "lucide-react";

export function SlaAlertBanner({ claims }: { claims: Claim[] }) {
  const activeClaims = claims.filter(
    (c) => c.status === "DRAFT" || c.status === "SUBMITTED" || c.status === "UNDER_REVIEW",
  );

  let breached = 0;
  let warning = 0;

  for (const claim of activeClaims) {
    const sla = computeSla(claim);
    if (sla.status === "BREACHED") breached++;
    else if (sla.status === "WARNING") warning++;
  }

  if (breached === 0 && warning === 0) return null;

  const isCritical = breached > 0;

  return (
    <div
      className={`flex items-center gap-2 rounded-md px-4 py-3 text-sm ${
        isCritical
          ? "bg-red-50 text-red-800 border border-red-200"
          : "bg-yellow-50 text-yellow-800 border border-yellow-200"
      }`}
    >
      <AlertTriangle className="h-4 w-4 flex-shrink-0" />
      <span>
        {breached > 0 && `${breached} claim${breached > 1 ? "s" : ""} SLA breached`}
        {breached > 0 && warning > 0 && ", "}
        {warning > 0 && `${warning} claim${warning > 1 ? "s" : ""} at risk`}
      </span>
    </div>
  );
}
