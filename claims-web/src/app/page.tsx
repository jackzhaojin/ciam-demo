import { auth, signIn } from "../../auth";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";

export default async function LandingPage() {
  const session = await auth();

  if (session) {
    redirect("/dashboard");
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
