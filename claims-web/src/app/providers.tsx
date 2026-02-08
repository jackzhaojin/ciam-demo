"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import { OrgContextProvider } from "@/lib/org-context";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <SessionProvider>
        <OrgContextProvider>{children}</OrgContextProvider>
      </SessionProvider>
    </ThemeProvider>
  );
}
