import { useAuthActions, useConvexAuth } from "@convex-dev/auth/react";
import { Authenticated, Unauthenticated } from "convex/react";
import { Loader2, LogIn, UserPlus } from "lucide-react";
import { FormEvent, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type AuthMode = "signIn" | "signUp";

export function AuthPage() {
  const navigate = useNavigate();
  const { signIn } = useAuthActions();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const [mode, setMode] = useState<AuthMode>("signIn");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    formData.set("flow", mode);

    try {
      await signIn("password", formData);
      toast.success(mode === "signUp" ? "Account created" : "Signed in");
      navigate("/dashboard");
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

  if (!isLoading && isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeading
        eyebrow="Authentication"
        title="Sign in to DolphinLMS"
        description="Email/password authentication is handled by Convex Auth. New accounts receive the student role by default."
      />

      <Authenticated>
        <Card>
          <CardHeader>
            <CardTitle>You are already signed in</CardTitle>
            <CardDescription>
              Continue to your role-aware dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link to="/dashboard">Open dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </Authenticated>

      <Unauthenticated>
        <Card>
          <CardHeader>
            <CardTitle>Team account</CardTitle>
            <CardDescription>
              Use the same form for first-time signup and returning students or
              mentors.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={mode} onValueChange={(value) => setMode(value as AuthMode)}>
              <TabsList className="mb-6 grid w-full grid-cols-2">
                <TabsTrigger value="signIn">
                  <LogIn className="size-4" />
                  Sign in
                </TabsTrigger>
                <TabsTrigger value="signUp">
                  <UserPlus className="size-4" />
                  Create account
                </TabsTrigger>
              </TabsList>

              <form onSubmit={handleSubmit} className="space-y-4">
                <TabsContent value="signUp" className="mt-0">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      name="name"
                      autoComplete="name"
                      placeholder="Avery Student"
                      required={mode === "signUp"}
                    />
                  </div>
                </TabsContent>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="student@example.com"
                    required
                  />
                </div>
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
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                  {mode === "signUp" ? "Create account" : "Sign in"}
                </Button>
              </form>
            </Tabs>
          </CardContent>
        </Card>
      </Unauthenticated>
    </div>
  );
}
