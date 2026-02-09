import { Check } from "lucide-react";
import type { ClaimStatus, ClaimEvent } from "@/types/claim";

const STEPS: { status: ClaimStatus; label: string }[] = [
  { status: "DRAFT", label: "Draft" },
  { status: "SUBMITTED", label: "Submitted" },
  { status: "UNDER_REVIEW", label: "Under Review" },
  { status: "APPROVED", label: "Decision" },
  { status: "CLOSED", label: "Closed" },
];

const STATUS_ORDER: Record<string, number> = {
  DRAFT: 0,
  SUBMITTED: 1,
  UNDER_REVIEW: 2,
  APPROVED: 3,
  DENIED: 3,
  CLOSED: 4,
};

export function WorkflowStepper({
  currentStatus,
  events,
}: {
  currentStatus: ClaimStatus;
  events: ClaimEvent[];
}) {
  const currentIndex = STATUS_ORDER[currentStatus] ?? 0;
  const isDenied = currentStatus === "DENIED";

  return (
    <div className="flex items-center gap-1">
      {STEPS.map((step, i) => {
        const isCompleted = i < currentIndex;
        const isCurrent = i === currentIndex;
        const isDeniedStep = isDenied && i === 3;

        const timestamp = events.find((e) => {
          const et = e.eventType?.toUpperCase();
          if (step.status === "DRAFT") return et === "CREATED";
          if (step.status === "SUBMITTED") return et === "SUBMITTED";
          if (step.status === "UNDER_REVIEW") return et === "REVIEWED";
          if (step.status === "APPROVED") return et === "APPROVED" || et === "DENIED";
          if (step.status === "CLOSED") return et === "CLOSED";
          return false;
        });

        return (
          <div key={step.status} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-medium ${
                  isCompleted
                    ? "bg-primary text-primary-foreground"
                    : isCurrent
                      ? isDeniedStep
                        ? "bg-red-500 text-white"
                        : "bg-primary text-primary-foreground ring-2 ring-primary/30"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {isCompleted ? (
                  <Check className="h-4 w-4" />
                ) : (
                  i + 1
                )}
              </div>
              <span className="text-xs mt-1 text-center max-w-[80px]">
                {isDeniedStep ? "Denied" : step.label}
              </span>
              {timestamp && (
                <span className="text-[10px] text-muted-foreground">
                  {new Date(timestamp.createdAt).toLocaleDateString()}
                </span>
              )}
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`h-px w-8 mx-1 ${
                  i < currentIndex ? "bg-primary" : "bg-muted"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
