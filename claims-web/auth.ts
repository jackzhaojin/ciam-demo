import NextAuth from "next-auth";
import Keycloak from "next-auth/providers/keycloak";
import type { Organizations } from "@/types/auth";

/**
 * Derive a deterministic UUID v3 from email bytes, matching
 * Java's UUID.nameUUIDFromBytes(email.getBytes(UTF_8)).
 * Uses dynamic import to avoid bundling Node crypto into Edge Runtime.
 */
async function uuidFromEmail(email: string): Promise<string> {
  const { createHash } = await import("crypto");
  const md5 = createHash("md5").update(email, "utf8").digest();
  md5[6] = (md5[6] & 0x0f) | 0x30; // version 3
  md5[8] = (md5[8] & 0x3f) | 0x80; // RFC 4122 variant
  const hex = md5.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

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
        token.idToken = account.id_token;
        token.expiresAt = account.expires_at;

        // Extract organizations from the ID token / profile
        const orgs =
          (profile as Record<string, unknown>)?.organizations ?? {};
        token.organizations = orgs as Organizations;

        // Extract loyalty tier from profile
        token.loyaltyTier =
          ((profile as Record<string, unknown>)?.loyalty_tier as string) ??
          undefined;

        // Derive stable user ID matching backend's UUID.nameUUIDFromBytes(email)
        const email = (profile as Record<string, unknown>)?.email ?? token.email;
        if (email) {
          token.userId = await uuidFromEmail(email as string);
        }
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
            idToken: tokens.id_token ?? token.idToken,
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
      // Use pre-computed userId (from jwt callback), fall back to sub
      session.user.id = (token.userId as string) ?? token.sub ?? "";
      session.user.organizations = (token.organizations ?? {}) as Organizations;
      session.user.loyaltyTier = token.loyaltyTier as string | undefined;
      session.accessToken = token.accessToken as string | undefined;

      if (token.error) {
        session.error = token.error as string;
      }

      return session;
    },
  },
  events: {
    async signOut(message) {
      // End Keycloak session on sign-out
      const issuer = process.env.KEYCLOAK_ISSUER_URI;
      const clientId = process.env.KEYCLOAK_BFF_CLIENT_ID;
      const clientSecret = process.env.KEYCLOAK_BFF_CLIENT_SECRET;
      if (issuer && clientId && clientSecret && "token" in message && message.token?.idToken) {
        const logoutUrl = `${issuer}/protocol/openid-connect/logout`;
        try {
          await fetch(logoutUrl, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              id_token_hint: message.token.idToken as string,
              client_id: clientId,
              client_secret: clientSecret,
            }),
          });
        } catch {
          // Best-effort — don't block sign-out if Keycloak is unreachable
        }
      }
    },
  },
  pages: {
    signIn: "/",
  },
});
