import type { Claim, ClaimEvent, SlaStatus } from "@/types/claim";

export interface SlaResult {
  status: SlaStatus;
  remainingMs: number;
  targetDate: Date | null;
  label: string;
}

// SLA rules (in milliseconds)
const SLA_RULES: Record<string, { targetMs: number; label: string }> = {
  DRAFT: { targetMs: 7 * 24 * 60 * 60 * 1000, label: "Submit within 7 days" },
  SUBMITTED: { targetMs: 48 * 60 * 60 * 1000, label: "Begin review within 48h" },
  UNDER_REVIEW: { targetMs: 14 * 24 * 60 * 60 * 1000, label: "Decision within 14 days" },
};

export function computeSla(claim: Claim, events?: ClaimEvent[]): SlaResult {
  const rule = SLA_RULES[claim.status];

  if (!rule) {
    return { status: "N_A", remainingMs: 0, targetDate: null, label: "Completed" };
  }

  // Find when the claim entered its current status
  let enteredAt: number;
  if (events && events.length > 0) {
    const statusEvent = [...events].reverse().find((e) => {
      const eventType = e.eventType?.toUpperCase();
      if (claim.status === "DRAFT") return eventType === "CREATED" || eventType === "UPDATED";
      if (claim.status === "SUBMITTED") return eventType === "SUBMITTED";
      if (claim.status === "UNDER_REVIEW") return eventType === "REVIEWED";
      return false;
    });
    enteredAt = statusEvent
      ? new Date(statusEvent.createdAt).getTime()
      : new Date(claim.updatedAt).getTime();
  } else {
    enteredAt = new Date(claim.updatedAt).getTime();
  }

  const targetDate = new Date(enteredAt + rule.targetMs);
  const remainingMs = targetDate.getTime() - Date.now();

  let status: SlaStatus;
  if (remainingMs < 0) {
    status = "BREACHED";
  } else if (remainingMs < rule.targetMs * 0.25) {
    status = "WARNING";
  } else {
    status = "OK";
  }

  const label =
    remainingMs < 0
      ? `Overdue ${Math.ceil(Math.abs(remainingMs) / (1000 * 60 * 60 * 24))} days`
      : remainingMs < 60 * 60 * 1000
        ? `${Math.ceil(remainingMs / (1000 * 60))}m remaining`
        : remainingMs < 24 * 60 * 60 * 1000
          ? `${Math.ceil(remainingMs / (1000 * 60 * 60))}h remaining`
          : `${Math.ceil(remainingMs / (1000 * 60 * 60 * 24))}d remaining`;

  return { status, remainingMs, targetDate, label };
}
