import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import type { ClaimStats } from "@/types/claim";

interface KpiCardProps {
  label: string;
  value: string;
}

function KpiCard({ label, value }: KpiCardProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold mt-1">{value}</p>
      </CardContent>
    </Card>
  );
}

export function KpiCards({ stats }: { stats: ClaimStats }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      <KpiCard label="Total Claims" value={stats.totalClaims.toString()} />
      <KpiCard label="Open Claims" value={stats.openClaims.toString()} />
      <KpiCard label="Total Exposure" value={formatCurrency(stats.totalExposure)} />
      <KpiCard label="Approval Rate" value={`${stats.approvalRate.toFixed(0)}%`} />
      <KpiCard label="This Week" value={stats.claimsThisWeek.toString()} />
    </div>
  );
}
