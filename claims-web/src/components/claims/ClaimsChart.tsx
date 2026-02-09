"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { ClaimStats } from "@/types/claim";

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "#9ca3af",
  SUBMITTED: "#3b82f6",
  UNDER_REVIEW: "#eab308",
  APPROVED: "#22c55e",
  DENIED: "#ef4444",
  CLOSED: "#6b7280",
};

const TYPE_COLORS: Record<string, string> = {
  AUTO: "#3b82f6",
  PROPERTY: "#8b5cf6",
  LIABILITY: "#f97316",
  HEALTH: "#22c55e",
};

export function ClaimsChart({ stats }: { stats: ClaimStats }) {
  const statusData = Object.entries(stats.claimsByStatus)
    .filter(([, count]) => count > 0)
    .map(([name, value]) => ({ name: name.replace(/_/g, " "), value, key: name }));

  const typeData = Object.entries(stats.claimsByType)
    .filter(([, count]) => count > 0)
    .map(([name, value]) => ({ name, value }));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">By Status</CardTitle>
        </CardHeader>
        <CardContent>
          {statusData.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No data</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={statusData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                >
                  {statusData.map((entry) => (
                    <Cell
                      key={entry.key}
                      fill={STATUS_COLORS[entry.key] ?? "#9ca3af"}
                    />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">By Type</CardTitle>
        </CardHeader>
        <CardContent>
          {typeData.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No data</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={typeData}>
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {typeData.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={TYPE_COLORS[entry.name] ?? "#9ca3af"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
