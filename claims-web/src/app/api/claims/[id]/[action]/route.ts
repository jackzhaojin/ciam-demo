import { auth } from "../../../../../../auth";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const actionEndpoints: Record<string, { method: string; path: (id: string) => string }> = {
  submit: { method: "POST", path: (id) => `/api/claims/${id}/submit` },
  review: { method: "POST", path: (id) => `/api/claims/${id}/review` },
  approve: { method: "POST", path: (id) => `/api/claims/${id}/approve` },
  deny: { method: "POST", path: (id) => `/api/claims/${id}/deny` },
  close: { method: "POST", path: (id) => `/api/claims/${id}/close` },
};

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; action: string }> },
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, action } = await params;
  const endpoint = actionEndpoints[action];

  if (!endpoint) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const backendUrl = process.env.BACKEND_URL;
  if (!backendUrl) {
    return NextResponse.json({ error: "Backend not configured" }, { status: 500 });
  }

  const cookieStore = await cookies();
  const orgId = cookieStore.get("selectedOrgId")?.value;

  const response = await fetch(`${backendUrl}${endpoint.path(id)}`, {
    method: endpoint.method,
    headers: {
      "Content-Type": "application/json",
      ...(orgId ? { "X-Organization-Id": orgId } : {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    return NextResponse.json(
      { error: text || "Action failed" },
      { status: response.status },
    );
  }

  if (response.status === 204) {
    return NextResponse.json({ success: true });
  }

  const data = await response.json();
  return NextResponse.json(data);
}
