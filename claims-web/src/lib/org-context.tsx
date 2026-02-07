"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { useSession } from "next-auth/react";
import type { OrganizationRoles } from "@/types/auth";

interface OrgContextValue {
  selectedOrg: OrganizationRoles | null;
  selectedOrgSlug: string | null;
  setOrg: (slug: string) => void;
  orgList: Array<{ slug: string } & OrganizationRoles>;
}

const OrgContext = createContext<OrgContextValue>({
  selectedOrg: null,
  selectedOrgSlug: null,
  setOrg: () => {},
  orgList: [],
});

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? decodeURIComponent(match[2]) : null;
}

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)};path=/;max-age=${60 * 60 * 24 * 365};samesite=lax`;
}

export function OrgContextProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  const [selectedOrgSlug, setSelectedOrgSlug] = useState<string | null>(null);

  const organizations = session?.user?.organizations ?? {};

  const orgList = Object.entries(organizations).map(([slug, org]) => ({
    slug,
    ...org,
  }));

  // Initialize selected org from cookie or default to first
  useEffect(() => {
    if (orgList.length === 0) {
      setSelectedOrgSlug(null);
      return;
    }

    const cookieValue = getCookie("selectedOrgSlug");

    // Validate that the cookie value is still in the user's orgs
    if (cookieValue && organizations[cookieValue]) {
      setSelectedOrgSlug(cookieValue);
    } else {
      // Default to first org
      const firstSlug = orgList[0].slug;
      setSelectedOrgSlug(firstSlug);
      setCookie("selectedOrgSlug", firstSlug);
      setCookie("selectedOrgId", organizations[firstSlug]?.id ?? firstSlug);
    }
  }, [session]); // eslint-disable-line react-hooks/exhaustive-deps

  const setOrg = useCallback(
    (slug: string) => {
      if (organizations[slug]) {
        setSelectedOrgSlug(slug);
        setCookie("selectedOrgSlug", slug);
        setCookie("selectedOrgId", organizations[slug].id ?? slug);
      }
    },
    [organizations],
  );

  const selectedOrg = selectedOrgSlug
    ? organizations[selectedOrgSlug] ?? null
    : null;

  return (
    <OrgContext.Provider
      value={{ selectedOrg, selectedOrgSlug, setOrg, orgList }}
    >
      {children}
    </OrgContext.Provider>
  );
}

export function useOrg() {
  return useContext(OrgContext);
}
