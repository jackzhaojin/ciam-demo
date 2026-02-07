import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import { OrgContextProvider, useOrg } from "@/lib/org-context";
import type { Organizations } from "@/types/auth";

const mockOrgs: Organizations = {
  "acme-corp": {
    id: "org-1",
    name: "Acme Corp",
    roles: ["admin"],
  },
  "globex-inc": {
    id: "org-2",
    name: "Globex Inc",
    roles: ["viewer"],
  },
};

// Mock next-auth/react
vi.mock("next-auth/react", () => ({
  useSession: () => ({
    data: {
      user: {
        id: "user-1",
        name: "Test User",
        email: "test@example.com",
        organizations: mockOrgs,
      },
      expires: new Date(Date.now() + 3600000).toISOString(),
    },
    status: "authenticated",
  }),
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
}));

function TestConsumer() {
  const { selectedOrg, selectedOrgSlug, orgList, setOrg } = useOrg();
  return (
    <div>
      <span data-testid="slug">{selectedOrgSlug ?? "none"}</span>
      <span data-testid="name">{selectedOrg?.name ?? "none"}</span>
      <span data-testid="count">{orgList.length}</span>
      <button onClick={() => setOrg("globex-inc")}>Switch</button>
    </div>
  );
}

describe("OrgContext", () => {
  beforeEach(() => {
    // Clear cookies
    document.cookie = "selectedOrgId=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    document.cookie = "selectedOrgSlug=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
  });

  it("provides org list from session", () => {
    render(
      <OrgContextProvider>
        <TestConsumer />
      </OrgContextProvider>,
    );

    expect(screen.getByTestId("count").textContent).toBe("2");
  });

  it("defaults to first org when no cookie", () => {
    render(
      <OrgContextProvider>
        <TestConsumer />
      </OrgContextProvider>,
    );

    expect(screen.getByTestId("slug").textContent).toBe("acme-corp");
    expect(screen.getByTestId("name").textContent).toBe("Acme Corp");
  });

  it("switches org on setOrg", async () => {
    render(
      <OrgContextProvider>
        <TestConsumer />
      </OrgContextProvider>,
    );

    // Wait for initial render to settle
    await waitFor(() => {
      expect(screen.getByTestId("slug").textContent).toBe("acme-corp");
    });

    await act(async () => {
      screen.getByText("Switch").click();
    });

    await waitFor(() => {
      expect(screen.getByTestId("slug").textContent).toBe("globex-inc");
      expect(screen.getByTestId("name").textContent).toBe("Globex Inc");
    });
  });
});
