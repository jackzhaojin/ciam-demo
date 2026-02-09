import { auth } from "../../../../../../auth";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const backendUrl = process.env.BACKEND_URL;
  if (!backendUrl) {
    return NextResponse.json({ error: "Backend not configured" }, { status: 500 });
  }

  const cookieStore = await cookies();
  const orgId = cookieStore.get("selectedOrgId")?.value;

  const response = await fetch(`${backendUrl}/api/claims/${id}/notes`, {
    headers: {
      "Content-Type": "application/json",
      ...(session.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : {}),
      ...(orgId ? { "X-Organization-Id": orgId } : {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    return NextResponse.json({ error: text || "Failed" }, { status: response.status });
  }

  const data = await response.json();
  return NextResponse.json(data);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const backendUrl = process.env.BACKEND_URL;
  if (!backendUrl) {
    return NextResponse.json({ error: "Backend not configured" }, { status: 500 });
  }

  const cookieStore = await cookies();
  const orgId = cookieStore.get("selectedOrgId")?.value;
  const body = await request.json();

  const response = await fetch(`${backendUrl}/api/claims/${id}/notes`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(session.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : {}),
      ...(orgId ? { "X-Organization-Id": orgId } : {}),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    return NextResponse.json({ error: text || "Failed" }, { status: response.status });
  }

  const data = await response.json();
  return NextResponse.json(data, { status: 201 });
}
