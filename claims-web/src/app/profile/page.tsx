import { auth } from "../../../auth";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export default async function ProfilePage() {
  const session = await auth();
  if (!session) redirect("/");

  const organizations = session.user?.organizations ?? {};
  const keycloakAccountUrl = process.env.KEYCLOAK_ISSUER_URI
    ? `${process.env.KEYCLOAK_ISSUER_URI.replace(/\/realms\/.*/, "")}/realms/${process.env.KEYCLOAK_ISSUER_URI.split("/realms/")[1]}/account`
    : null;

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold">Profile</h1>

      <Card>
        <CardHeader>
          <CardTitle>User Information</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Name</dt>
              <dd className="font-medium">{session.user?.name ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Email</dt>
              <dd className="font-medium">{session.user?.email ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Loyalty Tier</dt>
              <dd>
                <Badge variant="secondary">
                  {session.user?.loyaltyTier ?? "none"}
                </Badge>
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Organizations</CardTitle>
        </CardHeader>
        <CardContent>
          {Object.keys(organizations).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No organization memberships.
            </p>
          ) : (
            <div className="space-y-4">
              {Object.entries(organizations).map(([orgId, org]) => (
                <div key={orgId}>
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{org.name}</span>
                    <div className="flex gap-1">
                      {org.roles.map((role) => (
                        <Badge key={role} variant="outline" className="text-xs">
                          {role}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <Separator className="mt-3" />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {keycloakAccountUrl && (
        <Card>
          <CardHeader>
            <CardTitle>Account Management</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              Manage your password, MFA settings, and linked accounts in the
              identity provider console.
            </p>
            <a
              href={keycloakAccountUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary underline"
            >
              Open Account Console
            </a>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
