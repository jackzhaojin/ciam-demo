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
  selectedOrgId: string | null;
  setOrg: (orgId: string) => void;
  orgList: Array<{ id: string } & OrganizationRoles>;
}

const OrgContext = createContext<OrgContextValue>({
  selectedOrg: null,
  selectedOrgId: null,
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
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);

  const organizations = session?.user?.organizations ?? {};

  const orgList = Object.entries(organizations).map(([id, org]) => ({
    id,
    ...org,
  }));

  // Initialize selected org from cookie or default to first
  useEffect(() => {
    if (orgList.length === 0) {
      setSelectedOrgId(null);
      return;
    }

    const cookieValue = getCookie("selectedOrgId");

    // Validate that the cookie value is still in the user's orgs
    if (cookieValue && organizations[cookieValue]) {
      setSelectedOrgId(cookieValue);
    } else {
      // Default to first org
      const firstId = orgList[0].id;
      setSelectedOrgId(firstId);
      setCookie("selectedOrgId", firstId);
    }
  }, [session]); // eslint-disable-line react-hooks/exhaustive-deps

  const setOrg = useCallback(
    (orgId: string) => {
      if (organizations[orgId]) {
        setSelectedOrgId(orgId);
        setCookie("selectedOrgId", orgId);
      }
    },
    [organizations],
  );

  const selectedOrg = selectedOrgId
    ? organizations[selectedOrgId] ?? null
    : null;

  return (
    <OrgContext.Provider
      value={{ selectedOrg, selectedOrgId, setOrg, orgList }}
    >
      {children}
    </OrgContext.Provider>
  );
}

export function useOrg() {
  return useContext(OrgContext);
}
