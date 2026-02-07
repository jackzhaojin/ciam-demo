import { auth } from "../../../../auth";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { ClaimForm } from "@/components/claims/ClaimForm";
import type { CreateClaimRequest } from "@/types/claim";

export default async function NewClaimPage() {
  const session = await auth();
  if (!session) redirect("/");

  async function createClaim(data: CreateClaimRequest): Promise<{ id: string }> {
    "use server";

    const backendUrl = process.env.BACKEND_URL;
    if (!backendUrl) throw new Error("Backend not configured");

    const cookieStore = await cookies();
    const orgId = cookieStore.get("selectedOrgId")?.value;

    const response = await fetch(`${backendUrl}/api/claims`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(orgId ? { "X-Organization-Id": orgId } : {}),
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || "Failed to create claim");
    }

    return response.json();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">File a New Claim</h1>
      <ClaimForm onSubmit={createClaim} />
    </div>
  );
}
