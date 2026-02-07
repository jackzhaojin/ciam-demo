import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusBadge } from "@/components/claims/StatusBadge";
import type { ClaimStatus } from "@/types/claim";

describe("StatusBadge", () => {
  const statuses: ClaimStatus[] = [
    "DRAFT",
    "SUBMITTED",
    "UNDER_REVIEW",
    "APPROVED",
    "DENIED",
    "CLOSED",
  ];

  it.each(statuses)("renders %s status", (status) => {
    render(<StatusBadge status={status} />);
    const badge = screen.getByText(status.replace(/_/g, " "), {
      exact: false,
    });
    expect(badge).toBeInTheDocument();
  });

  it("renders DRAFT with correct label", () => {
    render(<StatusBadge status="DRAFT" />);
    expect(screen.getByText("Draft")).toBeInTheDocument();
  });

  it("renders UNDER_REVIEW with correct label", () => {
    render(<StatusBadge status="UNDER_REVIEW" />);
    expect(screen.getByText("Under Review")).toBeInTheDocument();
  });
});
