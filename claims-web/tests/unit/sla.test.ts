import { describe, it, expect } from "vitest";
import { computeSla } from "@/lib/sla";
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

describe("computeSla", () => {
  it("returns N_A for closed claims", () => {
    const result = computeSla(makeClaim({ status: "CLOSED" }));
    expect(result.status).toBe("N_A");
  });

  it("returns N_A for approved claims", () => {
    const result = computeSla(makeClaim({ status: "APPROVED" }));
    expect(result.status).toBe("N_A");
  });

  it("returns N_A for denied claims", () => {
    const result = computeSla(makeClaim({ status: "DENIED" }));
    expect(result.status).toBe("N_A");
  });

  it("returns OK for recently created draft", () => {
    const result = computeSla(
      makeClaim({ status: "DRAFT", updatedAt: new Date().toISOString() }),
    );
    expect(result.status).toBe("OK");
    expect(result.remainingMs).toBeGreaterThan(0);
  });

  it("returns BREACHED for old submitted claim", () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const result = computeSla(
      makeClaim({ status: "SUBMITTED", updatedAt: threeDaysAgo }),
    );
    expect(result.status).toBe("BREACHED");
    expect(result.remainingMs).toBeLessThan(0);
  });

  it("includes target date for active SLA", () => {
    const result = computeSla(
      makeClaim({ status: "DRAFT", updatedAt: new Date().toISOString() }),
    );
    expect(result.targetDate).not.toBeNull();
  });

  it("returns label with remaining time", () => {
    const result = computeSla(
      makeClaim({ status: "DRAFT", updatedAt: new Date().toISOString() }),
    );
    expect(result.label).toMatch(/remaining/);
  });

  it("returns label with overdue for breached", () => {
    const oldDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const result = computeSla(
      makeClaim({ status: "SUBMITTED", updatedAt: oldDate }),
    );
    expect(result.label).toMatch(/Overdue/);
  });
});
