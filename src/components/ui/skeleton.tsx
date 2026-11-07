import type * as React from "react";

import { cn } from "@/lib/utils";

/** Placeholder block shown while data loads. Size it like the content it stands in for. */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  );
}

/** A heading block plus a few rows: the default loading state for a page. */
function PageSkeleton({ rows = 4, label = "Loading" }: { rows?: number; label?: string }) {
  return (
    <div className="mx-auto max-w-6xl space-y-8" role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      <div className="space-y-3 border-b pb-6">
        <Skeleton className="h-8 w-64 max-w-full" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="grid gap-3">
        {Array.from({ length: rows }, (_, index) => (
          <Skeleton key={index} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}

/** Stacked rows for a list or table section that is still loading. */
function ListSkeleton({ rows = 3, className, label = "Loading" }: { rows?: number; className?: string; label?: string }) {
  return (
    <div className={cn("grid gap-2", className)} role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-12 w-full" />
      ))}
    </div>
  );
}

export { ListSkeleton, PageSkeleton, Skeleton };
