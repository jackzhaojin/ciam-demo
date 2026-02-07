import { auth } from "../../../../auth";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function TokenDebugPage() {
  const session = await auth();
  if (!session) redirect("/");

  const cookieStore = await cookies();
  const selectedOrgId = cookieStore.get("selectedOrgId")?.value ?? "none";

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-bold">Token Debugger</h1>
      <p className="text-sm text-muted-foreground">
        Development tool for inspecting the current session and organization
        context.
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Session Data</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="text-xs bg-muted p-4 rounded-md overflow-auto max-h-96">
            {JSON.stringify(session, null, 2)}
          </pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Organization Context</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Selected Org ID (cookie)</dt>
              <dd className="font-mono text-xs">{selectedOrgId}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Organization Memberships</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="text-xs bg-muted p-4 rounded-md overflow-auto max-h-96">
            {JSON.stringify(session.user?.organizations ?? {}, null, 2)}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
