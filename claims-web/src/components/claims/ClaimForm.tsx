"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { toast } from "sonner";
import type { ClaimType, CreateClaimRequest } from "@/types/claim";

const claimTypes: { value: ClaimType; label: string }[] = [
  { value: "AUTO", label: "Auto" },
  { value: "PROPERTY", label: "Property" },
  { value: "LIABILITY", label: "Liability" },
  { value: "HEALTH", label: "Health" },
];

const claimSchema = z.object({
  type: z.enum(["AUTO", "PROPERTY", "LIABILITY", "HEALTH"]),
  incidentDate: z.string().min(1, "Incident date is required").refine(
    (val) => {
      const date = new Date(val);
      return !isNaN(date.getTime()) && date <= new Date();
    },
    { message: "Incident date cannot be in the future" },
  ),
  description: z
    .string()
    .min(10, "Description must be at least 10 characters")
    .max(2000, "Description must be under 2000 characters"),
  amount: z
    .number({ message: "Amount is required" })
    .positive("Amount must be greater than zero")
    .max(10_000_000, "Amount cannot exceed $10,000,000"),
});

type ClaimFormData = z.infer<typeof claimSchema>;

// Fields validated per step (for partial validation on Next)
const stepFields: Record<number, (keyof ClaimFormData)[]> = {
  1: ["type"],
  2: ["incidentDate", "description"],
  3: ["amount"],
};

export function ClaimForm({
  onSubmit,
}: {
  onSubmit: (data: CreateClaimRequest) => Promise<{ id: string }>;
}) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    trigger,
    formState: { errors },
  } = useForm<ClaimFormData>({
    resolver: zodResolver(claimSchema),
    defaultValues: {
      type: "AUTO",
      description: "",
      amount: 0,
      incidentDate: new Date().toISOString().split("T")[0],
    },
    mode: "onTouched",
  });

  const formData = watch();

  const goNext = async () => {
    const fields = stepFields[step];
    if (fields) {
      const valid = await trigger(fields);
      if (!valid) return;
    }
    setStep((s) => s + 1);
  };

  const onFormSubmit = async (data: ClaimFormData) => {
    setSubmitting(true);
    try {
      const result = await onSubmit(data);
      toast.success("Claim created successfully");
      router.push(`/claims/${result.id}`);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to create claim";
      toast.error(message);
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
                setValue("type", v as ClaimType, { shouldValidate: true })
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
            {errors.type && (
              <p className="text-sm text-destructive">{errors.type.message}</p>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <div>
              <Label htmlFor="incidentDate">Incident Date</Label>
              <Input
                id="incidentDate"
                type="date"
                max={new Date().toISOString().split("T")[0]}
                {...register("incidentDate")}
              />
              {errors.incidentDate && (
                <p className="text-sm text-destructive mt-1">
                  {errors.incidentDate.message}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Describe the incident..."
                rows={5}
                {...register("description")}
              />
              {errors.description && (
                <p className="text-sm text-destructive mt-1">
                  {errors.description.message}
                </p>
              )}
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
              {...register("amount", { valueAsNumber: true })}
            />
            {errors.amount && (
              <p className="text-sm text-destructive mt-1">
                {errors.amount.message}
              </p>
            )}
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
                <dd>${(formData.amount ?? 0).toLocaleString()}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Description</dt>
                <dd className="mt-1">{formData.description || "\u2014"}</dd>
              </div>
            </dl>
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
            <Button onClick={goNext}>Next</Button>
          ) : (
            <Button
              onClick={handleSubmit(onFormSubmit)}
              disabled={submitting}
            >
              {submitting ? "Submitting..." : "Submit Claim"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
