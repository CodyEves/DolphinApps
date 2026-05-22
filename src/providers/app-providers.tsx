import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { Wrench } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Toaster } from "@/components/ui/sonner";
import { convex, hasConvexUrl } from "@/lib/convex";
import { ThemeProvider } from "@/providers/theme-provider";

function MissingConvexConfig() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wrench className="size-5 text-primary" />
            Convex is not configured yet
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            Run <code>bunx convex dev</code> and choose your personal Convex
            team when prompted. Convex will create a local environment file with
            <code> VITE_CONVEX_URL</code>.
          </p>
          <Button asChild>
            <a href="https://docs.convex.dev/quickstart/react" target="_blank">
              Open Convex React docs
            </a>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      {hasConvexUrl && convex ? (
        <ConvexAuthProvider client={convex}>{children}</ConvexAuthProvider>
      ) : (
        <MissingConvexConfig />
      )}
      <Toaster richColors closeButton />
    </ThemeProvider>
  );
}
