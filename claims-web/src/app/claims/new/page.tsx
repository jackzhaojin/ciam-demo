import { auth } from "../../../../auth";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { isAdmin } from "@/lib/permissions";
import { ClaimForm } from "@/components/claims/ClaimForm";
import { apiClient } from "@/lib/api";
import type { CreateClaimRequest } from "@/types/claim";

export default async function NewClaimPage() {
  const session = await auth();
  if (!session) redirect("/");

  const cookieStore = await cookies();
  const orgId = cookieStore.get("selectedOrgId")?.value;
  if (!orgId || !isAdmin(session, orgId)) {
    redirect("/dashboard");
  }

  async function createClaim(data: CreateClaimRequest): Promise<{ id: string }> {
    "use server";

    return apiClient<{ id: string }>("/api/claims", {
      method: "POST",
      body: data,
    });
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">File a New Claim</h1>
      <ClaimForm onSubmit={createClaim} />
    </div>
  );
}
