/**
 * PKCE (Proof Key for Code Exchange) utilities using Web Crypto API.
 * Generates code_verifier and code_challenge per RFC 7636.
 */

/**
 * Generate a cryptographically random code verifier (43-128 chars, unreserved characters).
 */
export function generateCodeVerifier(length = 64): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return base64urlEncode(array).slice(0, length);
}

/**
 * Generate the SHA-256 code challenge from a code verifier.
 */
export async function generateCodeChallenge(
  verifier: string,
): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return base64urlEncode(new Uint8Array(digest));
}

function base64urlEncode(buffer: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < buffer.length; i++) {
    binary += String.fromCharCode(buffer[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
