import { useAuthActions, useConvexAuth } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import { Copy, KeyRound, Loader2, LogIn, LogOut } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";

import { PageHeading } from "@/components/page-heading";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@convex/_generated/api";

type AuthMode = "signIn" | "setup" | "reset";

async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);

  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function AuthPage() {
  const { signIn, signOut } = useAuthActions();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const viewer = useQuery(api.profiles.viewer, isAuthenticated ? {} : "skip");
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mode: AuthMode = location.pathname.endsWith("/setup")
    ? "setup"
    : location.pathname.endsWith("/reset")
      ? "reset"
      : "signIn";
  const requestedReturnTo = searchParams.get("returnTo");
  const returnTo =
    mode === "signIn" && requestedReturnTo?.startsWith("/") && !requestedReturnTo.startsWith("//")
      ? requestedReturnTo
      : "/dashboard";
  const token = searchParams.get("token") ?? "";
  const [tokenHash, setTokenHash] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const purpose = mode === "setup" ? "initial_setup" : "password_reset";
  const preview = useQuery(
    api.access.getCredentialLinkPreview,
    mode === "signIn" || !token || !tokenHash ? "skip" : { tokenHash, purpose },
  );
  const invalidCredentialLink =
    mode !== "signIn" && (!token || preview === null);
  const pageCopy = useMemo(() => {
    if (mode === "setup") {
      return {
        eyebrow: "Account setup",
        title: "Create your password",
        description: "Use your one-time setup link to finish your team account.",
        button: "Set password",
      };
    }

    if (mode === "reset") {
      return {
        eyebrow: "Password reset",
        title: "Choose a new password",
        description: "Use your one-time reset link to replace your password.",
        button: "Update password",
      };
    }

    return {
      eyebrow: "Authentication",
      title: "Sign in to Dolphin Apps",
      description: "Use the username provided by an admin and your password.",
      button: "Sign in",
    };
  }, [mode]);
  const displayedPageCopy = invalidCredentialLink
    ? {
        eyebrow: "Account link",
        title: "Invalid or missing link",
        description: "Ask an admin for a current setup or password reset link.",
        button: pageCopy.button,
      }
    : pageCopy;

  useEffect(() => {
    let isMounted = true;

    if (mode === "signIn" || !token) {
      return;
    }

    void sha256Hex(token).then((hash) => {
      if (isMounted) {
        setTokenHash(hash);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [mode, token]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    formData.set("flow", mode);

    if (mode !== "signIn") {
      formData.set("token", token);
    }

    try {
      await signIn("password", formData);
      toast.success(mode === "signIn" ? "Signed in." : "Password saved.");
      navigate(mode === "signIn" ? returnTo : "/dashboard", { replace: true });
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : "Something went wrong signing in.";
      setError(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!isLoading && isAuthenticated && viewer) {
    return <Navigate to={viewer.profile.role === "kiosk" ? "/shop/display" : returnTo} replace />;
  }

  async function handleCopyUsername(username: string) {
    await navigator.clipboard.writeText(username);
    toast.success("Copied username.");
  }

  const hasStaleSession = !isLoading && isAuthenticated && viewer === null;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeading
        eyebrow={displayedPageCopy.eyebrow}
        title={displayedPageCopy.title}
        description={displayedPageCopy.description}
      />

      {viewer && (
        <Card>
          <CardHeader>
            <CardTitle>You are already signed in</CardTitle>
            <CardDescription>
              Continue to your dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link to="/dashboard">Open dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {!viewer && (
        <Card>
          <CardHeader>
            <CardTitle>{hasStaleSession ? "Refresh your session" : "Team account"}</CardTitle>
            <CardDescription>
              {hasStaleSession
                ? "Your browser has an incomplete sign-in session. Sign out here, then sign in again."
                : mode === "signIn"
                  ? "Only admin-provisioned accounts can sign in."
                  : "This one-time link can only be used once."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {hasStaleSession ? (
              <Button onClick={() => void signOut()}>
                <LogOut className="size-4" />
                Sign out and reset
              </Button>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {mode !== "signIn" && (
                  <div className="rounded-md border bg-muted/40 p-3 text-sm">
                    {!token && "This page requires a one-time setup or reset link."}
                    {token && preview === undefined && "Checking link..."}
                    {preview === null && "This link is invalid, expired, or already used."}
                    {preview && (
                      <div className="space-y-3">
                        <div>
                          <p className="font-medium">{preview.displayName}</p>
                          {preview.accountNumber && (
                            <p className="text-muted-foreground">Account ID: {preview.accountNumber}</p>
                          )}
                          <p className="text-muted-foreground">
                            Save this username. You will use it every time you sign in.
                          </p>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="generatedUsername">Your username</Label>
                          <div className="flex gap-2">
                            <Input
                              id="generatedUsername"
                              value={preview.username}
                              readOnly
                              className="font-mono text-base font-semibold"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => void handleCopyUsername(preview.username)}
                              aria-label="Copy username"
                            >
                              <Copy className="size-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {invalidCredentialLink ? (
                  <Button asChild className="w-full" variant="outline">
                    <Link to="/auth">Return to sign in</Link>
                  </Button>
                ) : mode === "signIn" ? (
                  <div className="space-y-2">
                    <Label htmlFor="username">Username</Label>
                    <Input
                      id="username"
                      name="username"
                      autoComplete="username"
                      placeholder="avery.s042"
                      required
                    />
                  </div>
                ) : null}
                {!invalidCredentialLink && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="password">Password</Label>
                      <Input
                        id="password"
                        name="password"
                        type="password"
                        autoComplete={mode === "signIn" ? "current-password" : "new-password"}
                        minLength={8}
                        required
                      />
                    </div>
                    {error && (
                      <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                        {error}
                      </p>
                    )}
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={isSubmitting || (mode !== "signIn" && !preview)}
                    >
                      {isSubmitting ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : mode === "signIn" ? (
                        <LogIn className="size-4" />
                      ) : (
                        <KeyRound className="size-4" />
                      )}
                      {pageCopy.button}
                    </Button>
                  </>
                )}
                {mode === "signIn" && (
                  <p className="text-sm text-muted-foreground">
                    Need access? Ask an admin or mentor to provision your account.
                  </p>
                )}
              </form>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

