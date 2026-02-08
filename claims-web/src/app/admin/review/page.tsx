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
import { getOrgRoles } from "@/lib/permissions";
import { apiClient } from "@/lib/api";
import type { Claim, ClaimsPage } from "@/types/claim";

async function fetchReviewQueue(): Promise<Claim[]> {
  const claims: Claim[] = [];

  for (const status of ["SUBMITTED", "UNDER_REVIEW"]) {
    try {
      const page = await apiClient<ClaimsPage>(
        `/api/claims?status=${status}&size=50&sort=filedDate,asc`,
      );
      claims.push(...page.content);
    } catch {
      // continue
    }
  }

  claims.sort(
    (a, b) => new Date(a.filedDate).getTime() - new Date(b.filedDate).getTime(),
  );

  return claims;
}

export default async function AdminReviewPage() {
  const session = await auth();
  if (!session) redirect("/");

  // Role-gate: only admins can access the review page
  const cookieStore = await cookies();
  const selectedOrgId = cookieStore.get("selectedOrgId")?.value ?? "";
  const roles = getOrgRoles(session.user?.organizations, selectedOrgId);
  if (!roles.includes("admin")) {
    redirect("/dashboard");
  }

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
