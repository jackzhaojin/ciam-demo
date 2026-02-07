export interface OrganizationRoles {
  name: string;
  roles: string[];
  attributes?: Record<string, string>;
}

/** Keys are org UUIDs (from Phase Two), not slugs */
export interface Organizations {
  [orgId: string]: OrganizationRoles;
}
