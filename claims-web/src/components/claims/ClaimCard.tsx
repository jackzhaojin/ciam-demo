import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "./StatusBadge";
import type { Claim } from "@/types/claim";

export function ClaimCard({ claim }: { claim: Claim }) {
  return (
    <Link href={`/claims/${claim.id}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">{claim.claimNumber}</CardTitle>
          <StatusBadge status={claim.status} />
        </CardHeader>
        <CardContent>
          <div className="text-xs text-muted-foreground space-y-1">
            <p>Type: {claim.type}</p>
            <p>Amount: ${claim.amount.toLocaleString()}</p>
            <p>Filed: {new Date(claim.filedDate).toLocaleDateString()}</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
