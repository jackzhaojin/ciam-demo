import type { Claim, PriorityLevel } from "@/types/claim";

export interface PriorityResult {
  priority: PriorityLevel;
  score: number;
}

export function computePriority(claim: Claim): PriorityResult {
  let score = 0;

  // Amount-based scoring
  if (claim.amount >= 100000) {
    score += 40;
  } else if (claim.amount >= 50000) {
    score += 30;
  } else if (claim.amount >= 10000) {
    score += 20;
  } else if (claim.amount >= 1000) {
    score += 10;
  }

  // Type-based scoring
  switch (claim.type) {
    case "LIABILITY":
      score += 20;
      break;
    case "PROPERTY":
      score += 15;
      break;
    case "HEALTH":
      score += 10;
      break;
    case "AUTO":
      score += 5;
      break;
  }

  // Age-based scoring
  if (claim.filedDate) {
    const daysOld = Math.floor(
      (Date.now() - new Date(claim.filedDate).getTime()) / (1000 * 60 * 60 * 24),
    );
    if (daysOld > 30) {
      score += 20;
    } else if (daysOld > 14) {
      score += 10;
    } else if (daysOld > 7) {
      score += 5;
    }
  }

  // Status-based boost
  if (claim.status === "SUBMITTED" || claim.status === "UNDER_REVIEW") {
    score += 10;
  }

  let priority: PriorityLevel;
  if (score >= 70) {
    priority = "CRITICAL";
  } else if (score >= 50) {
    priority = "HIGH";
  } else if (score >= 30) {
    priority = "MEDIUM";
  } else {
    priority = "LOW";
  }

  return { priority, score };
}
