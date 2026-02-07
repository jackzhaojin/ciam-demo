import { describe, it, expect } from "vitest";
import {
  hasRole,
  isAdmin,
  canCreateClaim,
  canApproveClaim,
  getOrgRoles,
} from "@/lib/permissions";
import type { Session } from "next-auth";
import type { Organizations } from "@/types/auth";

function makeSession(organizations: Organizations): Session {
  return {
    user: {
      id: "user-1",
      name: "Test User",
      email: "test@example.com",
      organizations,
    },
    expires: new Date(Date.now() + 3600000).toISOString(),
  };
}

const orgs: Organizations = {
  "org-1": {
    name: "Acme Corp",
    roles: ["admin", "billing"],
  },
  "org-2": {
    name: "Globex Inc",
    roles: ["viewer"],
  },
};

describe("getOrgRoles", () => {
  it("returns roles for a matching org id", () => {
    expect(getOrgRoles(orgs, "org-1")).toEqual(["admin", "billing"]);
  });

  it("returns empty array for unknown org id", () => {
    expect(getOrgRoles(orgs, "org-999")).toEqual([]);
  });

  it("returns empty array for undefined organizations", () => {
    expect(getOrgRoles(undefined, "org-1")).toEqual([]);
  });
});

describe("hasRole", () => {
  it("returns true when user has the role in the org", () => {
    const session = makeSession(orgs);
    expect(hasRole(session, "org-1", "admin")).toBe(true);
    expect(hasRole(session, "org-1", "billing")).toBe(true);
  });

  it("returns false when user does not have the role", () => {
    const session = makeSession(orgs);
    expect(hasRole(session, "org-2", "admin")).toBe(false);
  });

  it("returns false for null session", () => {
    expect(hasRole(null, "org-1", "admin")).toBe(false);
  });
});

describe("isAdmin", () => {
  it("returns true for admin role", () => {
    const session = makeSession(orgs);
    expect(isAdmin(session, "org-1")).toBe(true);
  });

  it("returns false for non-admin org", () => {
    const session = makeSession(orgs);
    expect(isAdmin(session, "org-2")).toBe(false);
  });
});

describe("canCreateClaim", () => {
  it("returns true for admin", () => {
    const session = makeSession(orgs);
    expect(canCreateClaim(session, "org-1")).toBe(true);
  });

  it("returns false for viewer-only", () => {
    const session = makeSession(orgs);
    expect(canCreateClaim(session, "org-2")).toBe(false);
  });

  it("returns false for null session", () => {
    expect(canCreateClaim(null, "org-1")).toBe(false);
  });
});

describe("canApproveClaim", () => {
  it("returns true for admin role", () => {
    const session = makeSession(orgs);
    expect(canApproveClaim(session, "org-1")).toBe(true);
  });

  it("returns true for billing role", () => {
    const billingOrgs: Organizations = {
      "org-3": {
        name: "Billing Org",
        roles: ["billing"],
      },
    };
    const session = makeSession(billingOrgs);
    expect(canApproveClaim(session, "org-3")).toBe(true);
  });

  it("returns false for viewer-only", () => {
    const session = makeSession(orgs);
    expect(canApproveClaim(session, "org-2")).toBe(false);
  });
});
