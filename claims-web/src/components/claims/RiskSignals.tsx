import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { RiskSignalsResponse } from "@/types/claim";

const severityColors: Record<string, string> = {
  HIGH: "border-l-red-500",
  MEDIUM: "border-l-yellow-500",
  LOW: "border-l-green-500",
};

const riskBadgeColors: Record<string, string> = {
  HIGH: "bg-red-100 text-red-700 hover:bg-red-100",
  MEDIUM: "bg-yellow-100 text-yellow-700 hover:bg-yellow-100",
  LOW: "bg-green-100 text-green-700 hover:bg-green-100",
};

export function RiskSignals({ data }: { data: RiskSignalsResponse }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">Risk Assessment</CardTitle>
          <Badge variant="secondary" className={riskBadgeColors[data.overallRisk] ?? ""}>
            {data.overallRisk} ({data.riskScore})
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {data.signals.map((signal, i) => (
          <div
            key={i}
            className={`border-l-4 pl-3 py-2 ${severityColors[signal.severity] ?? "border-l-gray-300"}`}
          >
            <p className="text-sm font-medium">{signal.label}</p>
            <p className="text-xs text-muted-foreground">{signal.description}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
