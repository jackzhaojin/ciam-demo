import { describe, it, expect } from "vitest";
import { generateCodeVerifier, generateCodeChallenge } from "@/lib/pkce";

describe("PKCE utilities", () => {
  it("generateCodeVerifier returns a string of the requested length", () => {
    const verifier = generateCodeVerifier(64);
    expect(verifier).toHaveLength(64);
  });

  it("generateCodeVerifier uses only URL-safe characters", () => {
    const verifier = generateCodeVerifier(128);
    // Base64url characters: A-Z, a-z, 0-9, -, _
    expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("generateCodeVerifier produces unique values", () => {
    const v1 = generateCodeVerifier();
    const v2 = generateCodeVerifier();
    expect(v1).not.toEqual(v2);
  });

  it("generateCodeChallenge returns a base64url-encoded SHA-256 hash", async () => {
    const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
    const challenge = await generateCodeChallenge(verifier);
    // The challenge should be a non-empty base64url string
    expect(challenge).toBeTruthy();
    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
    // No padding characters
    expect(challenge).not.toContain("=");
  });

  it("generateCodeChallenge is deterministic for the same verifier", async () => {
    const verifier = generateCodeVerifier();
    const c1 = await generateCodeChallenge(verifier);
    const c2 = await generateCodeChallenge(verifier);
    expect(c1).toEqual(c2);
  });

  it("generateCodeChallenge produces different outputs for different verifiers", async () => {
    const c1 = await generateCodeChallenge(generateCodeVerifier());
    const c2 = await generateCodeChallenge(generateCodeVerifier());
    expect(c1).not.toEqual(c2);
  });

  it("code challenge has expected length for SHA-256 output", async () => {
    const verifier = generateCodeVerifier();
    const challenge = await generateCodeChallenge(verifier);
    // SHA-256 = 32 bytes = 43 base64url chars (without padding)
    expect(challenge).toHaveLength(43);
  });
});
