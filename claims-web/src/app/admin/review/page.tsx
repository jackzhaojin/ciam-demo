import { auth } from "../../../../auth";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/claims/StatusBadge";
import { AdminActions } from "./AdminActions";
import type { Claim, ClaimsPage } from "@/types/claim";

async function fetchReviewQueue(): Promise<Claim[]> {
  const backendUrl = process.env.BACKEND_URL;
  if (!backendUrl) return [];

  const cookieStore = await cookies();
  const orgId = cookieStore.get("selectedOrgId")?.value;

  const claims: Claim[] = [];

  for (const status of ["SUBMITTED", "UNDER_REVIEW"]) {
    try {
      const response = await fetch(
        `${backendUrl}/api/claims?status=${status}&size=50&sort=filedDate,asc`,
        {
          headers: {
            "Content-Type": "application/json",
            ...(orgId ? { "X-Organization-Id": orgId } : {}),
          },
          cache: "no-store",
        },
      );
      if (response.ok) {
        const page: ClaimsPage = await response.json();
        claims.push(...page.content);
      }
    } catch {
      // continue
    }
  }

  // Sort by filed date oldest first
  claims.sort(
    (a, b) => new Date(a.filedDate).getTime() - new Date(b.filedDate).getTime(),
  );

  return claims;
}

export default async function AdminReviewPage() {
  const session = await auth();
  if (!session) redirect("/");

  const claims = await fetchReviewQueue();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Admin Review Queue</h1>

      {claims.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>No claims pending review.</p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Claim Number</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Filed Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {claims.map((claim) => (
                <TableRow key={claim.id}>
                  <TableCell>
                    <Link
                      href={`/claims/${claim.id}`}
                      className="text-primary underline"
                    >
                      {claim.claimNumber}
                    </Link>
                  </TableCell>
                  <TableCell>{claim.type}</TableCell>
                  <TableCell>
                    <StatusBadge status={claim.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    ${claim.amount.toLocaleString()}
                  </TableCell>
                  <TableCell>
                    {new Date(claim.filedDate).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <AdminActions claim={claim} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
