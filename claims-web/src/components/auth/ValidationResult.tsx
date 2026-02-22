"use client";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface ValidationDetails {
  method: string;
  offlineValidation: boolean;
  steps: string[];
  durationMs: number;
}

interface ValidationResultData {
  success: boolean;
  strategy: string;
  strategyLabel: string;
  tokenSummary?: Record<string, unknown>;
  validationDetails?: ValidationDetails;
  error?: string;
}

export function ValidationResult({ data }: { data: ValidationResultData }) {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Badge variant={data.success ? "default" : "destructive"}>
          {data.success ? "PASS" : "FAIL"}
        </Badge>
        <span className="text-sm font-medium">{data.strategyLabel}</span>
        {data.validationDetails && (
          <span className="text-xs text-muted-foreground">
            {data.validationDetails.durationMs}ms
            {data.validationDetails.offlineValidation
              ? " (offline)"
              : " (online)"}
          </span>
        )}
      </div>

      {data.error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {data.error}
        </div>
      )}

      {/* Validation Steps */}
      {data.validationDetails?.steps && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">
              Validation Steps ({data.validationDetails.steps.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-1 text-xs font-mono">
              {data.validationDetails.steps.map((step, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-muted-foreground shrink-0 w-5 text-right">
                    {i + 1}.
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}

      {/* Token Claims */}
      {data.tokenSummary && Object.keys(data.tokenSummary).length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Token Claims</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs font-mono bg-muted p-3 rounded-md overflow-auto max-h-64">
              {JSON.stringify(data.tokenSummary, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
