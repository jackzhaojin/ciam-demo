import { auth, signIn, signOut } from "../../auth";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";

export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  const params = await searchParams;

  // If session exists and is healthy, go to dashboard
  if (session && !session.error && params.error !== "session_expired") {
    redirect("/dashboard");
  }

  // If session exists but token refresh failed, sign out to clear stale session
  if (session?.error === "RefreshAccessTokenError" || params.error === "session_expired") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-3.5rem)] gap-8">
        <div className="text-center space-y-4 max-w-lg">
          <h1 className="text-4xl font-bold tracking-tight">Claims Portal</h1>
          <p className="text-lg text-muted-foreground">
            Your session has expired. Please sign in again.
          </p>
        </div>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/" });
          }}
        >
          <Button size="lg" type="submit" variant="outline">
            Sign Out &amp; Re-authenticate
          </Button>
        </form>
        <form
          action={async () => {
            "use server";
            await signIn("keycloak", { redirectTo: "/dashboard" });
          }}
        >
          <Button size="lg" type="submit">
            Sign In
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-3.5rem)] gap-8">
      <div className="text-center space-y-4 max-w-lg">
        <h1 className="text-4xl font-bold tracking-tight">Claims Portal</h1>
        <p className="text-lg text-muted-foreground">
          Manage your insurance claims securely. File, track, and review claims
          across your organizations.
        </p>
      </div>
      <form
        action={async () => {
          "use server";
          await signIn("keycloak", { redirectTo: "/dashboard" });
        }}
      >
        <Button size="lg" type="submit">
          Sign In
        </Button>
      </form>
    </div>
  );
}
