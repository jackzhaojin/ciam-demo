"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { useOrg } from "@/lib/org-context";
import { isAdmin, canApproveClaim } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { Claim, ClaimStatus } from "@/types/claim";

interface ActionDef {
  label: string;
  action: string;
  variant: "default" | "destructive" | "outline";
  show: (status: ClaimStatus, admin: boolean, approver: boolean, isOwner: boolean) => boolean;
}

const actions: ActionDef[] = [
  {
    label: "Submit",
    action: "submit",
    variant: "default",
    show: (s, a, _ap, isOwner) => s === "DRAFT" && (isOwner || a),
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
  const isOwner = !!session?.user?.id && session.user.id === claim.userId;

  const visibleActions = actions.filter((a) =>
    a.show(claim.status, admin, approver, isOwner),
  );

  if (visibleActions.length === 0) return null;

  const actionLabels: Record<string, string> = {
    submit: "submitted",
    review: "moved to review",
    approve: "approved",
    deny: "denied",
    close: "closed",
  };

  const handleAction = async (action: string) => {
    setLoading(action);
    try {
      const response = await fetch(`/api/claims/${claim.id}/${action}`, {
        method: "POST",
      });
      if (response.ok) {
        toast.success(`Claim ${actionLabels[action] ?? action} successfully`);
        router.refresh();
      } else {
        const data = await response.json().catch(() => null);
        const message = data?.error || `Failed to ${action} claim`;
        toast.error(message);
      }
    } catch {
      toast.error("Network error. Please try again.");
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
