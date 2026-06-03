import { useAuthActions, useConvexAuth } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import { KeyRound, Loader2, LogIn, LogOut } from "lucide-react";
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
  const token = searchParams.get("token") ?? "";
  const [tokenHash, setTokenHash] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const purpose = mode === "setup" ? "initial_setup" : "password_reset";
  const preview = useQuery(
    api.access.getCredentialLinkPreview,
    mode === "signIn" || !token || !tokenHash ? "skip" : { tokenHash, purpose },
  );
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
      navigate("/dashboard", { replace: true });
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
    return <Navigate to="/dashboard" replace />;
  }

  const hasStaleSession = !isLoading && isAuthenticated && viewer === null;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeading
        eyebrow={pageCopy.eyebrow}
        title={pageCopy.title}
        description={pageCopy.description}
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
                    {preview === undefined && "Checking link..."}
                    {preview === null && "This link is invalid, expired, or already used."}
                    {preview && (
                      <div>
                        <p className="font-medium">{preview.displayName}</p>
                        <p className="text-muted-foreground">Username: {preview.username}</p>
                      </div>
                    )}
                  </div>
                )}
                {mode === "signIn" && (
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
                )}
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
                {mode === "signIn" && (
                  <p className="text-sm text-muted-foreground">
                    Need access? Ask an admin or mentor to create an account for you.
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

