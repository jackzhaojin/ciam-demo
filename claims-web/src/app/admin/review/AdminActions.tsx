"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { Claim } from "@/types/claim";

export function AdminActions({ claim }: { claim: Claim }) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

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

  if (claim.status === "SUBMITTED") {
    return (
      <div className="flex gap-1">
        <Button
          size="sm"
          variant="outline"
          onClick={() => handleAction("review")}
          disabled={loading !== null}
        >
          {loading === "review" ? "..." : "Review"}
        </Button>
      </div>
    );
  }

  if (claim.status === "UNDER_REVIEW") {
    return (
      <div className="flex gap-1">
        <Button
          size="sm"
          onClick={() => handleAction("approve")}
          disabled={loading !== null}
        >
          {loading === "approve" ? "..." : "Approve"}
        </Button>
        <Button
          size="sm"
          variant="destructive"
          onClick={() => handleAction("deny")}
          disabled={loading !== null}
        >
          {loading === "deny" ? "..." : "Deny"}
        </Button>
      </div>
    );
  }

  return null;
}
