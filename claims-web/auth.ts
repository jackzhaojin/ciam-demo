import NextAuth from "next-auth";
import Keycloak from "next-auth/providers/keycloak";
import type { Organizations } from "@/types/auth";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Keycloak({
      clientId: process.env.KEYCLOAK_BFF_CLIENT_ID,
      clientSecret: process.env.KEYCLOAK_BFF_CLIENT_SECRET,
      issuer: process.env.KEYCLOAK_ISSUER_URI,
    }),
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      // On initial sign-in, store tokens and extract custom claims
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.expiresAt = account.expires_at;

        // Extract organizations from the ID token / profile
        const orgs =
          (profile as Record<string, unknown>)?.organizations ?? {};
        token.organizations = orgs as Organizations;

        // Extract loyalty tier from profile
        token.loyaltyTier =
          ((profile as Record<string, unknown>)?.loyalty_tier as string) ??
          undefined;
      }

      // If token hasn't expired, return as-is
      const expiresAt = token.expiresAt as number | undefined;
      if (expiresAt && Date.now() < expiresAt * 1000) {
        return token;
      }

      // Token expired — refresh it
      const refreshToken = token.refreshToken as string | undefined;
      if (refreshToken) {
        try {
          const issuer = process.env.KEYCLOAK_ISSUER_URI!;
          const tokenUrl = `${issuer}/protocol/openid-connect/token`;

          const response = await fetch(tokenUrl, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              grant_type: "refresh_token",
              client_id: process.env.KEYCLOAK_BFF_CLIENT_ID!,
              client_secret: process.env.KEYCLOAK_BFF_CLIENT_SECRET!,
              refresh_token: refreshToken,
            }),
          });

          const tokens = await response.json();

          if (!response.ok) {
            throw new Error("Token refresh failed");
          }

          return {
            ...token,
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token ?? refreshToken,
            expiresAt: Math.floor(Date.now() / 1000 + tokens.expires_in),
          };
        } catch {
          token.error = "RefreshAccessTokenError";
          return token;
        }
      }

      return token;
    },

    async session({ session, token }) {
      session.user.id = token.sub ?? "";
      session.user.organizations = (token.organizations ?? {}) as Organizations;
      session.user.loyaltyTier = token.loyaltyTier as string | undefined;
      session.accessToken = token.accessToken as string | undefined;

      if (token.error) {
        session.error = token.error as string;
      }

      return session;
    },
  },
  pages: {
    signIn: "/",
  },
});
