export type ClaimStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "DENIED"
  | "CLOSED";

export type ClaimType = "AUTO" | "PROPERTY" | "LIABILITY" | "HEALTH";

export type PriorityLevel = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export type SlaStatus = "OK" | "WARNING" | "BREACHED" | "N_A";

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
  priority: PriorityLevel;
  priorityScore: number;
}

export interface ClaimEvent {
  id: string;
  claimId: string;
  eventType: string;
  actorUserId: string;
  actorDisplayName?: string;
  note?: string;
  timestamp: string;
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

export interface ClaimStats {
  totalClaims: number;
  openClaims: number;
  claimsByStatus: Record<string, number>;
  claimsByType: Record<string, number>;
  totalExposure: number;
  approvalRate: number;
  claimsThisWeek: number;
  claimsByPriority: Record<string, number>;
}

export interface RiskSignal {
  severity: string;
  label: string;
  description: string;
}

export interface RiskSignalsResponse {
  overallRisk: string;
  riskScore: number;
  signals: RiskSignal[];
}

export interface ClaimNote {
  id: string;
  claimId: string;
  authorUserId: string;
  authorDisplayName: string;
  content: string;
  createdAt: string;
}

export interface ClaimAttachment {
  id: string;
  claimId: string;
  filename: string;
  fileSizeBytes: number;
  mimeType: string;
  uploadedByUserId: string;
  uploadedByDisplayName: string;
  createdAt: string;
}
