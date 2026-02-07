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
  if (!session?.user?.organizations) return false;
  // Any org member can create claims, except viewers
  const roles = getOrgRoles(session.user.organizations, orgId);
  if (roles.length === 0) return false;
  // If the only role is viewer, they can't create
  if (roles.length === 1 && roles[0] === "viewer") return false;
  return true;
}

export function canApproveClaim(
  session: Session | null,
  orgId: string,
): boolean {
  return hasRole(session, orgId, "admin") || hasRole(session, orgId, "billing");
}
