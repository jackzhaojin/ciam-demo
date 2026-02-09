import { auth } from "../../../../auth";
import { redirect, notFound } from "next/navigation";
import { cookies } from "next/headers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/claims/StatusBadge";
import { PriorityBadge } from "@/components/claims/PriorityBadge";
import { ClaimTimeline } from "@/components/claims/ClaimTimeline";
import { WorkflowStepper } from "@/components/claims/WorkflowStepper";
import { RiskSignals } from "@/components/claims/RiskSignals";
import { SlaCard } from "@/components/claims/SlaCard";
import { NotesThread } from "@/components/claims/NotesThread";
import { DocumentsSection } from "@/components/claims/DocumentsSection";
import { ClaimActions } from "./ClaimActions";
import { apiClient } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { isAdmin } from "@/lib/permissions";
import type {
  Claim,
  ClaimEvent,
  RiskSignalsResponse,
  ClaimNote,
  ClaimAttachment,
  PriorityLevel,
} from "@/types/claim";

async function fetchClaim(id: string): Promise<Claim | null> {
  try {
    return await apiClient<Claim>(`/api/claims/${id}`);
  } catch {
    return null;
  }
}

async function fetchEvents(id: string): Promise<ClaimEvent[]> {
  try {
    return await apiClient<ClaimEvent[]>(`/api/claims/${id}/events`);
  } catch {
    return [];
  }
}

async function fetchRiskSignals(id: string): Promise<RiskSignalsResponse | null> {
  try {
    return await apiClient<RiskSignalsResponse>(`/api/claims/${id}/risk-signals`);
  } catch {
    return null;
  }
}

async function fetchNotes(id: string): Promise<ClaimNote[]> {
  try {
    return await apiClient<ClaimNote[]>(`/api/claims/${id}/notes`);
  } catch {
    return [];
  }
}

async function fetchAttachments(id: string): Promise<ClaimAttachment[]> {
  try {
    return await apiClient<ClaimAttachment[]>(`/api/claims/${id}/attachments`);
  } catch {
    return [];
  }
}

export default async function ClaimDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/");

  const { id } = await params;
  const [claim, events, riskSignals, notes, attachments] = await Promise.all([
    fetchClaim(id),
    fetchEvents(id),
    fetchRiskSignals(id),
    fetchNotes(id),
    fetchAttachments(id),
  ]);

  if (!claim) notFound();

  const cookieStore = await cookies();
  const orgId = cookieStore.get("selectedOrgId")?.value ?? "";
  const admin = isAdmin(session, orgId);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-bold">{claim.claimNumber}</h1>
        <StatusBadge status={claim.status} />
        <PriorityBadge priority={claim.priority as PriorityLevel} />
      </div>

      <WorkflowStepper currentStatus={claim.status} events={events} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: details + actions + timeline + notes */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Claim Details</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-muted-foreground">Type</dt>
                  <dd className="font-medium">{claim.type}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Amount</dt>
                  <dd className="font-medium">{formatCurrency(claim.amount)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Incident Date</dt>
                  <dd className="font-medium">
                    {new Date(claim.incidentDate).toLocaleDateString()}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Filed Date</dt>
                  <dd className="font-medium">
                    {new Date(claim.filedDate).toLocaleDateString()}
                  </dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-muted-foreground">Description</dt>
                  <dd className="font-medium mt-1">{claim.description}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <ClaimActions claim={claim} />

          <div>
            <h2 className="text-lg font-semibold mb-4">Activity Timeline</h2>
            <ClaimTimeline events={events} />
          </div>

          <NotesThread
            claimId={claim.id}
            initialNotes={notes}
            canAddNote={!session.user?.organizations ? false : true}
          />
        </div>

        {/* Right column: SLA + priority + risk signals + documents */}
        <div className="space-y-6">
          <SlaCard claim={claim} events={events} />

          {riskSignals && <RiskSignals data={riskSignals} />}

          <DocumentsSection
            claimId={claim.id}
            initialAttachments={attachments}
            canAdd={admin}
          />
        </div>
      </div>
    </div>
  );
}
