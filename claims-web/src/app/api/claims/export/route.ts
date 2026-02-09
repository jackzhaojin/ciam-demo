import { auth } from "../../../../../auth";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const backendUrl = process.env.BACKEND_URL;
  if (!backendUrl) {
    return NextResponse.json({ error: "Backend not configured" }, { status: 500 });
  }

  const cookieStore = await cookies();
  const orgId = cookieStore.get("selectedOrgId")?.value;

  const response = await fetch(`${backendUrl}/api/claims/export`, {
    headers: {
      ...(session.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : {}),
      ...(orgId ? { "X-Organization-Id": orgId } : {}),
    },
  });

  if (!response.ok) {
    return NextResponse.json({ error: "Export failed" }, { status: response.status });
  }

  const csv = await response.text();
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": 'attachment; filename="claims-export.csv"',
    },
  });
}
