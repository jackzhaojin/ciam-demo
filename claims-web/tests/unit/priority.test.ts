import { describe, it, expect } from "vitest";
import { computePriority } from "@/lib/priority";
import type { Claim } from "@/types/claim";

function makeClaim(overrides: Partial<Claim> = {}): Claim {
  return {
    id: "1",
    claimNumber: "CLM-2026-00001",
    type: "AUTO",
    status: "DRAFT",
    description: "Test",
    amount: 1000,
    incidentDate: "2026-01-01",
    filedDate: new Date().toISOString(),
    organizationId: "org1",
    userId: "user1",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    priority: "LOW",
    priorityScore: 0,
    ...overrides,
  };
}

describe("computePriority", () => {
  it("returns LOW for small recent auto claims", () => {
    const result = computePriority(makeClaim({ amount: 500, type: "AUTO" }));
    expect(result.priority).toBe("LOW");
    expect(result.score).toBeLessThan(30);
  });

  it("returns MEDIUM for moderate property claims", () => {
    const result = computePriority(
      makeClaim({
        amount: 15000,
        type: "PROPERTY",
        status: "DRAFT",
        filedDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      }),
    );
    expect(result.priority).toBe("MEDIUM");
  });

  it("returns HIGH for large liability claims", () => {
    const result = computePriority(
      makeClaim({
        amount: 60000,
        type: "LIABILITY",
        status: "UNDER_REVIEW",
        filedDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      }),
    );
    expect(result.priority).toBe("HIGH");
  });

  it("returns CRITICAL for very large old claims", () => {
    const result = computePriority(
      makeClaim({
        amount: 150000,
        type: "LIABILITY",
        status: "SUBMITTED",
        filedDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
      }),
    );
    expect(result.priority).toBe("CRITICAL");
  });

  it("adds status boost for SUBMITTED", () => {
    const draft = computePriority(makeClaim({ status: "DRAFT", amount: 2000 }));
    const submitted = computePriority(makeClaim({ status: "SUBMITTED", amount: 2000 }));
    expect(submitted.score).toBeGreaterThan(draft.score);
  });
});
