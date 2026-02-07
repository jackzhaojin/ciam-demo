import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ClaimTimeline } from "@/components/claims/ClaimTimeline";
import type { ClaimEvent } from "@/types/claim";

describe("ClaimTimeline", () => {
  it("renders empty state message when no events", () => {
    render(<ClaimTimeline events={[]} />);
    expect(screen.getByText("No events recorded yet.")).toBeInTheDocument();
  });

  it("renders events with event type and description", () => {
    const events: ClaimEvent[] = [
      {
        id: "evt-1",
        claimId: "claim-1",
        eventType: "CLAIM_CREATED",
        description: "Claim was created",
        performedBy: "user-1",
        performedByName: "John Doe",
        createdAt: "2025-01-15T10:00:00Z",
      },
      {
        id: "evt-2",
        claimId: "claim-1",
        eventType: "STATUS_CHANGED",
        description: "Status changed to SUBMITTED",
        performedBy: "user-1",
        performedByName: "John Doe",
        createdAt: "2025-01-15T11:00:00Z",
      },
    ];

    render(<ClaimTimeline events={events} />);
    expect(screen.getByText("CLAIM CREATED")).toBeInTheDocument();
    expect(screen.getByText("Claim was created")).toBeInTheDocument();
    expect(screen.getByText("STATUS CHANGED")).toBeInTheDocument();
  });

  it("shows performer name when available", () => {
    const events: ClaimEvent[] = [
      {
        id: "evt-1",
        claimId: "claim-1",
        eventType: "REVIEWED",
        description: "Reviewed by admin",
        performedBy: "user-2",
        performedByName: "Admin User",
        createdAt: "2025-01-16T09:00:00Z",
      },
    ];

    render(<ClaimTimeline events={events} />);
    expect(screen.getByText(/Admin User/)).toBeInTheDocument();
  });
});
