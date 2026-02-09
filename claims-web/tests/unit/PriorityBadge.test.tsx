import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PriorityBadge } from "@/components/claims/PriorityBadge";
import type { PriorityLevel } from "@/types/claim";

describe("PriorityBadge", () => {
  const priorities: PriorityLevel[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

  it.each(priorities)("renders %s priority", (priority) => {
    render(<PriorityBadge priority={priority} />);
    const badge = screen.getByText(priority.charAt(0) + priority.slice(1).toLowerCase());
    expect(badge).toBeInTheDocument();
  });

  it("renders CRITICAL with correct label", () => {
    render(<PriorityBadge priority="CRITICAL" />);
    expect(screen.getByText("Critical")).toBeInTheDocument();
  });

  it("renders LOW with correct label", () => {
    render(<PriorityBadge priority="LOW" />);
    expect(screen.getByText("Low")).toBeInTheDocument();
  });
});
