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
    <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="max-w-3xl space-y-3">
        {eyebrow && <Badge variant="secondary">{eyebrow}</Badge>}
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-normal sm:text-3xl">
            {title}
          </h1>
          <p className="text-sm leading-6 text-muted-foreground sm:text-base">
            {description}
          </p>
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
