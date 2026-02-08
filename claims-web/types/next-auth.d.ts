import type { DefaultSession } from "next-auth";
import type { Organizations } from "@/types/auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      organizations: Organizations;
      loyaltyTier?: string;
    } & DefaultSession["user"];
    accessToken?: string;
    error?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    idToken?: string;
    expiresAt?: number;
    organizations?: Organizations;
    loyaltyTier?: string;
    error?: string;
  }
}
