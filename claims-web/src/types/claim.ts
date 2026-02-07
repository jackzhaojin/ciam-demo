export type ClaimStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "DENIED"
  | "CLOSED";

export type ClaimType = "AUTO" | "PROPERTY" | "LIABILITY" | "HEALTH";

export interface Claim {
  id: string;
  claimNumber: string;
  type: ClaimType;
  status: ClaimStatus;
  description: string;
  amount: number;
  incidentDate: string;
  filedDate: string;
  organizationId: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ClaimEvent {
  id: string;
  claimId: string;
  eventType: string;
  description: string;
  performedBy: string;
  performedByName?: string;
  createdAt: string;
}

export interface CreateClaimRequest {
  type: ClaimType;
  description: string;
  amount: number;
  incidentDate: string;
}

export interface ClaimsPage {
  content: Claim[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}
