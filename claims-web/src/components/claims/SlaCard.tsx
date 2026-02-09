import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Claim, ClaimEvent } from "@/types/claim";
import { computeSla } from "@/lib/sla";

const statusColors: Record<string, string> = {
  OK: "bg-green-500",
  WARNING: "bg-yellow-500",
  BREACHED: "bg-red-500",
  N_A: "bg-gray-300",
};

export function SlaCard({ claim, events }: { claim: Claim; events?: ClaimEvent[] }) {
  const sla = computeSla(claim, events);

  if (sla.status === "N_A") {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">SLA Status</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No active SLA — claim is {claim.status.toLowerCase().replace(/_/g, " ")}</p>
        </CardContent>
      </Card>
    );
  }

  const totalMs = sla.targetDate
    ? sla.targetDate.getTime() - (sla.targetDate.getTime() - sla.remainingMs - (Date.now() - (Date.now() - sla.remainingMs)))
    : 0;

  // Calculate progress percentage
  let progress = 0;
  if (sla.status === "BREACHED") {
    progress = 100;
  } else if (sla.targetDate) {
    const elapsed = Date.now() - (sla.targetDate.getTime() - (sla.remainingMs + (Date.now() - (Date.now()))));
    const total = sla.remainingMs + elapsed;
    progress = total > 0 ? Math.min(100, Math.max(0, (elapsed / total) * 100)) : 0;
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">SLA Status</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">{sla.label}</span>
          <span
            className={`inline-block h-2 w-2 rounded-full ${statusColors[sla.status]}`}
          />
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${statusColors[sla.status]}`}
            style={{ width: `${progress}%` }}
          />
        </div>
        {sla.targetDate && (
          <p className="text-xs text-muted-foreground">
            Target: {sla.targetDate.toLocaleDateString()} {sla.targetDate.toLocaleTimeString()}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
