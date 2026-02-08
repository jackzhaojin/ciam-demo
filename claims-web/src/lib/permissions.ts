import type { Session } from "next-auth";
import type { Organizations } from "@/types/auth";

export function getOrgRoles(
  organizations: Organizations | undefined,
  orgId: string,
): string[] {
  if (!organizations) return [];

  const org = organizations[orgId];
  return org?.roles ?? [];
}

export function hasRole(
  session: Session | null,
  orgId: string,
  role: string,
): boolean {
  if (!session?.user?.organizations) return false;
  const roles = getOrgRoles(session.user.organizations, orgId);
  return roles.includes(role);
}

export function isAdmin(session: Session | null, orgId: string): boolean {
  return hasRole(session, orgId, "admin");
}

export function canCreateClaim(session: Session | null, orgId: string): boolean {
  // Only admins can create claims (spec: viewer and billing cannot create)
  return isAdmin(session, orgId);
}

export function canApproveClaim(
  session: Session | null,
  orgId: string,
): boolean {
  return hasRole(session, orgId, "admin") || hasRole(session, orgId, "billing");
}
