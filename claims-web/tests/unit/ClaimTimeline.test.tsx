import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ClaimTimeline } from "@/components/claims/ClaimTimeline";
import type { ClaimEvent } from "@/types/claim";

describe("ClaimTimeline", () => {
  it("renders empty state message when no events", () => {
    render(<ClaimTimeline events={[]} />);
    expect(screen.getByText("No events recorded yet.")).toBeInTheDocument();
  });

  it("renders events with event type and note", () => {
    const events: ClaimEvent[] = [
      {
        id: "evt-1",
        claimId: "claim-1",
        eventType: "CREATED",
        actorUserId: "user-1",
        actorDisplayName: "John Doe",
        note: "Claim was created",
        timestamp: "2025-01-15T10:00:00Z",
      },
      {
        id: "evt-2",
        claimId: "claim-1",
        eventType: "SUBMITTED",
        actorUserId: "user-1",
        actorDisplayName: "John Doe",
        timestamp: "2025-01-15T11:00:00Z",
      },
    ];

    render(<ClaimTimeline events={events} />);
    expect(screen.getByText("CREATED")).toBeInTheDocument();
    expect(screen.getByText("Claim was created")).toBeInTheDocument();
    expect(screen.getByText("SUBMITTED")).toBeInTheDocument();
  });

  it("shows actor display name when available", () => {
    const events: ClaimEvent[] = [
      {
        id: "evt-1",
        claimId: "claim-1",
        eventType: "REVIEWED",
        actorUserId: "user-2",
        actorDisplayName: "Admin User",
        timestamp: "2025-01-16T09:00:00Z",
      },
    ];

    render(<ClaimTimeline events={events} />);
    expect(screen.getByText(/Admin User/)).toBeInTheDocument();
  });
});
