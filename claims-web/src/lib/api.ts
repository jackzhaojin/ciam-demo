import { auth } from "../../auth";
import { redirect } from "next/navigation";

interface ApiOptions {
  method?: string;
  body?: unknown;
  organizationId?: string;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiClient<T>(
  path: string,
  options: ApiOptions = {},
): Promise<T> {
  const session = await auth();

  if (!session?.user) {
    redirect("/");
  }

  const backendUrl = process.env.BACKEND_URL;
  if (!backendUrl) {
    throw new Error("BACKEND_URL environment variable is not set");
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  // Attach Bearer token for Spring Boot backend authentication
  if (session.accessToken) {
    headers["Authorization"] = `Bearer ${session.accessToken}`;
  }

  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  const orgId = options.organizationId ?? cookieStore.get("selectedOrgId")?.value;

  if (orgId) {
    headers["X-Organization-Id"] = orgId;
  }

  const response = await fetch(`${backendUrl}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (response.status === 401) {
    redirect("/");
  }

  if (response.status === 403) {
    throw new ApiError("You do not have permission to perform this action", 403);
  }

  if (!response.ok) {
    const text = await response.text();
    throw new ApiError(text || `Request failed with status ${response.status}`, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}
