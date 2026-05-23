import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { Wrench } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Toaster } from "@/components/ui/sonner";
import { convex, hasConvexUrl } from "@/lib/convex";
import { RolePreviewProvider } from "@/providers/role-preview-provider";
import { ThemeProvider } from "@/providers/theme-provider";

function MissingBackendConfig() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wrench className="size-5 text-primary" />
            DolphinLMS is not ready yet
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            The training service is not connected. Ask an administrator to finish
            setup before signing in.
          </p>
          <Button disabled>Setup required</Button>
        </CardContent>
      </Card>
    </main>
  );
}

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <RolePreviewProvider>
        {hasConvexUrl && convex ? (
          <ConvexAuthProvider client={convex}>{children}</ConvexAuthProvider>
        ) : (
          <MissingBackendConfig />
        )}
      </RolePreviewProvider>
      <Toaster richColors closeButton />
    </ThemeProvider>
  );
}
