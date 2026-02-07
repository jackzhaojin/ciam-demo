export interface OrganizationRoles {
  id: string;
  name: string;
  roles: string[];
  attributes?: Record<string, string>;
}

export interface Organizations {
  [orgSlug: string]: OrganizationRoles;
}
