"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useOrg } from "@/lib/org-context";
import { isAdmin } from "@/lib/permissions";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", requiresAdmin: false },
  { href: "/claims/new", label: "File Claim", requiresAdmin: true },
  { href: "/admin/review", label: "Admin Review", requiresAdmin: true },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { selectedOrgId } = useOrg();

  const orgId = selectedOrgId ?? "";
  const showAdmin = isAdmin(session, orgId);
  const { selectedOrg } = useOrg();
  const contractTier = selectedOrg?.attributes?.contractTier;

  return (
    <aside className="w-56 border-r bg-muted/30 p-4">
      {contractTier && (
        <div className="mb-4 px-3 py-2 rounded-md bg-muted text-xs text-muted-foreground">
          Tier: <span className="font-medium capitalize">{contractTier}</span>
        </div>
      )}
      <nav className="space-y-1">
        {navItems
          .filter((item) => !item.requiresAdmin || showAdmin)
          .map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "block rounded-md px-3 py-2 text-sm font-medium transition-colors",
                pathname === item.href || pathname.startsWith(item.href + "/")
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {item.label}
            </Link>
          ))}
      </nav>
    </aside>
  );
}
