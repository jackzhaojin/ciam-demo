"use client";

import { SessionProvider } from "next-auth/react";
import { OrgContextProvider } from "@/lib/org-context";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <OrgContextProvider>{children}</OrgContextProvider>
    </SessionProvider>
  );
}
