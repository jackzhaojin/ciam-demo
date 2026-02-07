import { auth } from "../../../../auth";
import { redirect, notFound } from "next/navigation";
import { cookies } from "next/headers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/claims/StatusBadge";
import { ClaimTimeline } from "@/components/claims/ClaimTimeline";
import { ClaimActions } from "./ClaimActions";
import type { Claim, ClaimEvent } from "@/types/claim";

async function fetchClaim(id: string): Promise<Claim | null> {
  const session = await auth();
  const backendUrl = process.env.BACKEND_URL;
  if (!backendUrl) return null;

  const cookieStore = await cookies();
  const orgId = cookieStore.get("selectedOrgId")?.value;

  try {
    const response = await fetch(`${backendUrl}/api/claims/${id}`, {
      headers: {
        "Content-Type": "application/json",
        ...(session?.accessToken
          ? { Authorization: `Bearer ${session.accessToken}` }
          : {}),
        ...(orgId ? { "X-Organization-Id": orgId } : {}),
      },
      cache: "no-store",
    });
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

async function fetchEvents(id: string): Promise<ClaimEvent[]> {
  const session = await auth();
  const backendUrl = process.env.BACKEND_URL;
  if (!backendUrl) return [];

  const cookieStore = await cookies();
  const orgId = cookieStore.get("selectedOrgId")?.value;

  try {
    const response = await fetch(`${backendUrl}/api/claims/${id}/events`, {
      headers: {
        "Content-Type": "application/json",
        ...(session?.accessToken
          ? { Authorization: `Bearer ${session.accessToken}` }
          : {}),
        ...(orgId ? { "X-Organization-Id": orgId } : {}),
      },
      cache: "no-store",
    });
    if (!response.ok) return [];
    return response.json();
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
  const [claim, events] = await Promise.all([
    fetchClaim(id),
    fetchEvents(id),
  ]);

  if (!claim) notFound();

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-bold">{claim.claimNumber}</h1>
        <StatusBadge status={claim.status} />
      </div>

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
              <dd className="font-medium">${claim.amount.toLocaleString()}</dd>
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

      <Separator />

      <div>
        <h2 className="text-lg font-semibold mb-4">Activity Timeline</h2>
        <ClaimTimeline events={events} />
      </div>
    </div>
  );
}
