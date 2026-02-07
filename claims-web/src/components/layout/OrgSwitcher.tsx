"use client";

import { useOrg } from "@/lib/org-context";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function OrgSwitcher() {
  const { selectedOrgSlug, setOrg, orgList } = useOrg();

  if (orgList.length === 0) {
    return <span className="text-sm text-muted-foreground">No organizations</span>;
  }

  return (
    <Select value={selectedOrgSlug ?? undefined} onValueChange={setOrg}>
      <SelectTrigger className="w-[200px]">
        <SelectValue placeholder="Select organization" />
      </SelectTrigger>
      <SelectContent>
        {orgList.map((org) => (
          <SelectItem key={org.slug} value={org.slug}>
            {org.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
