"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { useOrg } from "@/lib/org-context";
import { isAdmin, canApproveClaim } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import type { Claim, ClaimStatus } from "@/types/claim";

interface ActionDef {
  label: string;
  action: string;
  variant: "default" | "destructive" | "outline";
  show: (status: ClaimStatus, admin: boolean, approver: boolean) => boolean;
}

const actions: ActionDef[] = [
  {
    label: "Submit",
    action: "submit",
    variant: "default",
    show: (s) => s === "DRAFT",
  },
  {
    label: "Begin Review",
    action: "review",
    variant: "outline",
    show: (s, a) => s === "SUBMITTED" && a,
  },
  {
    label: "Approve",
    action: "approve",
    variant: "default",
    show: (s, _a, ap) => s === "UNDER_REVIEW" && ap,
  },
  {
    label: "Deny",
    action: "deny",
    variant: "destructive",
    show: (s, a) => s === "UNDER_REVIEW" && a,
  },
  {
    label: "Close",
    action: "close",
    variant: "outline",
    show: (s, a) => (s === "APPROVED" || s === "DENIED") && a,
  },
];

export function ClaimActions({ claim }: { claim: Claim }) {
  const router = useRouter();
  const { data: session } = useSession();
  const { selectedOrgId } = useOrg();
  const [loading, setLoading] = useState<string | null>(null);

  const orgId = selectedOrgId ?? "";
  const admin = isAdmin(session, orgId);
  const approver = canApproveClaim(session, orgId);

  const visibleActions = actions.filter((a) =>
    a.show(claim.status, admin, approver),
  );

  if (visibleActions.length === 0) return null;

  const handleAction = async (action: string) => {
    setLoading(action);
    try {
      const response = await fetch(`/api/claims/${claim.id}/${action}`, {
        method: "POST",
      });
      if (response.ok) {
        router.refresh();
      }
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="flex gap-2">
      {visibleActions.map((a) => (
        <Button
          key={a.action}
          variant={a.variant}
          onClick={() => handleAction(a.action)}
          disabled={loading !== null}
        >
          {loading === a.action ? "Processing..." : a.label}
        </Button>
      ))}
    </div>
  );
}
