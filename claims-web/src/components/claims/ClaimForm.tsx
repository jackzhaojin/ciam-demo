"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import type { ClaimType, CreateClaimRequest } from "@/types/claim";

const claimTypes: { value: ClaimType; label: string }[] = [
  { value: "AUTO", label: "Auto" },
  { value: "PROPERTY", label: "Property" },
  { value: "LIABILITY", label: "Liability" },
  { value: "HEALTH", label: "Health" },
];

export function ClaimForm({
  onSubmit,
}: {
  onSubmit: (data: CreateClaimRequest) => Promise<{ id: string }>;
}) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<CreateClaimRequest>({
    type: "AUTO",
    description: "",
    amount: 0,
    incidentDate: new Date().toISOString().split("T")[0],
  });

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const result = await onSubmit(formData);
      router.push(`/claims/${result.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create claim");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>
          {step === 1 && "Claim Type"}
          {step === 2 && "Incident Details"}
          {step === 3 && "Claim Amount"}
          {step === 4 && "Review & Submit"}
        </CardTitle>
        <div className="flex gap-2 mt-2">
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full ${
                s <= step ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {step === 1 && (
          <div className="space-y-3">
            <Label htmlFor="claimType">Select claim type</Label>
            <Select
              value={formData.type}
              onValueChange={(v) =>
                setFormData({ ...formData, type: v as ClaimType })
              }
            >
              <SelectTrigger id="claimType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {claimTypes.map((ct) => (
                  <SelectItem key={ct.value} value={ct.value}>
                    {ct.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <div>
              <Label htmlFor="incidentDate">Incident Date</Label>
              <Input
                id="incidentDate"
                type="date"
                value={formData.incidentDate}
                onChange={(e) =>
                  setFormData({ ...formData, incidentDate: e.target.value })
                }
              />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Describe the incident..."
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                rows={5}
              />
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <Label htmlFor="amount">Claim Amount ($)</Label>
            <Input
              id="amount"
              type="number"
              min={0}
              step={0.01}
              value={formData.amount || ""}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  amount: parseFloat(e.target.value) || 0,
                })
              }
            />
          </div>
        )}

        {step === 4 && (
          <div className="space-y-3">
            <h3 className="font-medium">Review your claim</h3>
            <Separator />
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Type</dt>
                <dd>{formData.type}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Incident Date</dt>
                <dd>{formData.incidentDate}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Amount</dt>
                <dd>${formData.amount.toLocaleString()}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Description</dt>
                <dd className="mt-1">{formData.description || "—"}</dd>
              </div>
            </dl>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>
        )}

        <div className="flex justify-between pt-4">
          <Button
            variant="outline"
            onClick={() => setStep((s) => s - 1)}
            disabled={step === 1}
          >
            Back
          </Button>
          {step < 4 ? (
            <Button onClick={() => setStep((s) => s + 1)}>Next</Button>
          ) : (
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Submitting..." : "Submit Claim"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
