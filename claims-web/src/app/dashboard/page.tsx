import { auth } from "../../../auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/claims/StatusBadge";
import { apiClient } from "@/lib/api";
import type { ClaimsPage, ClaimStatus } from "@/types/claim";

const statusTabs: { value: string; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "DRAFT", label: "Draft" },
  { value: "SUBMITTED", label: "Submitted" },
  { value: "UNDER_REVIEW", label: "Under Review" },
  { value: "APPROVED", label: "Approved" },
  { value: "DENIED", label: "Denied" },
  { value: "CLOSED", label: "Closed" },
];

async function fetchClaims(
  status?: string,
  page: number = 0,
): Promise<ClaimsPage | null> {
  const params = new URLSearchParams();
  if (status && status !== "ALL") params.set("status", status);
  params.set("page", page.toString());
  params.set("size", "20");

  try {
    return await apiClient<ClaimsPage>(`/api/claims?${params.toString()}`);
  } catch {
    return null;
  }
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/");

  const params = await searchParams;
  const status = params.status ?? "ALL";
  const page = parseInt(params.page ?? "0", 10);
  const data = await fetchClaims(status, page);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Claims Dashboard</h1>
        <Link href="/claims/new">
          <Button>File New Claim</Button>
        </Link>
      </div>

      <Tabs defaultValue={status}>
        <TabsList>
          {statusTabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} asChild>
              <Link
                href={`/dashboard?status=${tab.value}`}
                className="cursor-pointer"
              >
                {tab.label}
              </Link>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={status} className="mt-4">
          {!data ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : data.content.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>No claims found.</p>
              <Link href="/claims/new" className="text-primary underline mt-2 block">
                File your first claim
              </Link>
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Claim Number</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Filed Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.content.map((claim) => (
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
                          <StatusBadge status={claim.status as ClaimStatus} />
                        </TableCell>
                        <TableCell className="text-right">
                          ${claim.amount.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          {new Date(claim.filedDate).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {data.totalPages > 1 && (
                <div className="flex justify-center gap-2 mt-4">
                  {page > 0 && (
                    <Link href={`/dashboard?status=${status}&page=${page - 1}`}>
                      <Button variant="outline" size="sm">
                        Previous
                      </Button>
                    </Link>
                  )}
                  <span className="flex items-center text-sm text-muted-foreground px-2">
                    Page {page + 1} of {data.totalPages}
                  </span>
                  {page < data.totalPages - 1 && (
                    <Link href={`/dashboard?status=${status}&page=${page + 1}`}>
                      <Button variant="outline" size="sm">
                        Next
                      </Button>
                    </Link>
                  )}
                </div>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
