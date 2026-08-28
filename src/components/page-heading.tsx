import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";

export function PageHeading({
  title,
  description,
  eyebrow,
  actions,
}: {
  title: string;
  description: string;
  eyebrow?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-col gap-4 border-b pb-5 lg:flex-row lg:items-end lg:justify-between">
      <div className="max-w-3xl space-y-3">
        {eyebrow && (
          <Badge
            variant="secondary"
            className="text-[11px] font-semibold uppercase tracking-[0.08em]"
          >
            {eyebrow}
          </Badge>
        )}
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-[2rem]">
            {title}
          </h1>
          <p className="text-sm leading-6 text-muted-foreground sm:text-base">
            {description}
          </p>
        </div>
      </div>
      {actions && (
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
          {actions}
        </div>
      )}
    </div>
  );
}
