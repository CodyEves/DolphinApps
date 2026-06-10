import { AlertTriangle, Home, RefreshCw } from "lucide-react";
import { isRouteErrorResponse, Link, useRouteError } from "react-router";

import { Button } from "@/components/ui/button";

function errorMessage(error: unknown) {
  if (isRouteErrorResponse(error)) {
    return `${error.status} ${error.statusText}`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Something unexpected happened.";
}

export function RouteErrorPage() {
  const error = useRouteError();
  const message = errorMessage(error);

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-3xl flex-col items-center justify-center text-center">
        <img
          src="/favicon.svg"
          alt="Robot Dolphins"
          className="mb-6 size-24 rounded-full border bg-primary shadow-sm"
        />
        <div className="mb-3 flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-sm text-muted-foreground">
          <AlertTriangle className="size-4 text-destructive" />
          Dolphin Apps hit a snag
        </div>
        <h1 className="text-3xl font-semibold tracking-normal sm:text-4xl">
          This page could not load cleanly.
        </h1>
        <p className="mt-3 max-w-xl text-muted-foreground">
          Try refreshing the page. If it keeps happening, send an admin the message below so we can track it down.
        </p>
        <div className="mt-6 w-full rounded-md border bg-card p-4 text-left">
          <p className="text-xs font-medium uppercase text-muted-foreground">Error</p>
          <p className="mt-2 break-words font-mono text-sm">{message}</p>
        </div>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Button type="button" onClick={() => window.location.reload()}>
            <RefreshCw className="size-4" />
            Refresh
          </Button>
          <Button asChild variant="outline">
            <Link to="/">
              <Home className="size-4" />
              Go home
            </Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
