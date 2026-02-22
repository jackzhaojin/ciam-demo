"use client";

import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ValidationResult } from "./ValidationResult";
import { generateCodeVerifier, generateCodeChallenge } from "@/lib/pkce";

interface Strategy {
  key: string;
  label: string;
  offline: boolean;
}

interface AuthConfig {
  issuerUri: string;
  clientId: string;
}

interface TokenData {
  accessToken: string;
  refreshToken?: string;
  idToken?: string;
  expiresIn: number;
}

interface ValidationResultData {
  success: boolean;
  strategy: string;
  strategyLabel: string;
  tokenSummary?: Record<string, unknown>;
  validationDetails?: {
    method: string;
    offlineValidation: boolean;
    steps: string[];
    durationMs: number;
  };
  tokens?: TokenData;
  error?: string;
}

export function LoginPage() {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [authConfig, setAuthConfig] = useState<AuthConfig | null>(null);
  const [selectedStrategy, setSelectedStrategy] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ValidationResultData | null>(null);
  const [tokens, setTokens] = useState<TokenData | null>(null);
  const [sessionLoading, setSessionLoading] = useState(false);

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ||
    (typeof window !== "undefined"
      ? `${window.location.protocol}//${window.location.hostname}:8080`
      : "http://localhost:8080");

  useEffect(() => {
    // Fetch strategies and config from Spring Boot
    Promise.all([
      fetch(`${backendUrl}/api/auth/strategies`).then((r) => r.json()),
      fetch(`${backendUrl}/api/auth/config`).then((r) => r.json()),
    ])
      .then(([strats, config]) => {
        setStrategies(strats);
        setAuthConfig(config);
        if (strats.length > 0) {
          setSelectedStrategy(strats[0].key);
        }
      })
      .catch((err) => {
        setError("Failed to load auth config: " + err.message);
      });
  }, [backendUrl]);

  const handlePkceLogin = async () => {
    if (!authConfig) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setTokens(null);

    try {
      // Step 1: Generate PKCE pair
      const codeVerifier = generateCodeVerifier();
      const codeChallenge = await generateCodeChallenge(codeVerifier);

      // Step 2: Build the Keycloak authorization URL
      const redirectUri = window.location.origin + "/login";
      const authUrl = new URL(
        `${authConfig.issuerUri}/protocol/openid-connect/auth`,
      );
      authUrl.searchParams.set("client_id", authConfig.clientId);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("redirect_uri", redirectUri);
      authUrl.searchParams.set("scope", "openid email profile");
      authUrl.searchParams.set("code_challenge", codeChallenge);
      authUrl.searchParams.set("code_challenge_method", "S256");

      // Step 3: Use proxy to get the login form (server-to-server, bypasses CORS)
      const formResp = await fetch("/api/auth/pkce-proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "get-login-form",
          authUrl: authUrl.toString(),
        }),
      });
      const formData = await formResp.json();
      if (formData.error) throw new Error(formData.error);

      // Step 4: Submit credentials via proxy
      const credResp = await fetch("/api/auth/pkce-proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "submit-credentials",
          formActionUrl: formData.formActionUrl,
          username,
          password,
          cookies: formData.cookies,
        }),
      });
      const credData = await credResp.json();
      if (credData.error) throw new Error(credData.error);

      // Step 5: Exchange auth code via Spring Boot + validate with strategy
      const callbackResp = await fetch(
        `${backendUrl}/api/auth/pkce-callback`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            authorizationCode: credData.code,
            codeVerifier,
            strategy: selectedStrategy,
            redirectUri,
          }),
        },
      );
      const callbackData: ValidationResultData = await callbackResp.json();
      setResult(callbackData);
      if (callbackData.success && callbackData.tokens) {
        setTokens(callbackData.tokens);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "PKCE login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleContinueToDashboard = async () => {
    if (!tokens) return;
    setSessionLoading(true);
    await signIn("pkce-session", {
      callbackUrl: "/dashboard",
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken ?? "",
      idToken: tokens.idToken ?? "",
      expiresIn: String(tokens.expiresIn),
    });
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-3.5rem)] gap-8 p-6">
      <div className="text-center space-y-2 max-w-lg">
        <h1 className="text-3xl font-bold tracking-tight">
          Authentication Strategy Demo
        </h1>
        <p className="text-muted-foreground">
          Compare how different token validation strategies work under the hood.
        </p>
      </div>

      <div className="grid gap-6 w-full max-w-2xl">
        {/* Section A: Standard BFF Login */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Standard Login (BFF Pattern)</CardTitle>
            <CardDescription>
              Auth.js handles OIDC invisibly. Tokens stored in encrypted
              server-side cookies.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => signIn("keycloak", { callbackUrl: "/dashboard" })}
              className="w-full"
            >
              Sign In with Keycloak
            </Button>
          </CardContent>
        </Card>

        {/* Section B: PKCE Strategy Demo */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              PKCE Login (Strategy Demo)
            </CardTitle>
            <CardDescription>
              Manual PKCE flow with selectable backend validation strategy.
              See exactly what happens at each step.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="username">Username (email)</Label>
                <Input
                  id="username"
                  type="email"
                  placeholder="admin@test.com"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Test1234"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="strategy">Validation Strategy</Label>
                <Select
                  value={selectedStrategy}
                  onValueChange={setSelectedStrategy}
                >
                  <SelectTrigger className="w-full" id="strategy">
                    <SelectValue placeholder="Select a strategy" />
                  </SelectTrigger>
                  <SelectContent>
                    {strategies.map((s) => (
                      <SelectItem key={s.key} value={s.key}>
                        <div className="flex items-center gap-2">
                          <span>{s.label}</span>
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1.5 py-0"
                          >
                            {s.offline ? "offline" : "online"}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button
              onClick={handlePkceLogin}
              disabled={loading || !username || !password || !selectedStrategy}
              className="w-full"
              variant="secondary"
            >
              {loading ? "Authenticating..." : "Sign In with PKCE"}
            </Button>

            {error && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            {result && <ValidationResult data={result} />}

            {tokens && (
              <Button
                onClick={handleContinueToDashboard}
                disabled={sessionLoading}
                className="w-full"
              >
                {sessionLoading
                  ? "Creating session..."
                  : "Continue to Dashboard"}
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
