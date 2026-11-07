import type { ReactNode } from "react";

/**
 * Page title block. The app name already shows in the top bar, so there is no
 * eyebrow label here: the title itself should say what this page is for.
 */
export function PageHeading({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  /** Deprecated: ignored. The top bar names the app. */
  eyebrow?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="max-w-3xl space-y-2">
        <h1 className="text-[1.75rem] leading-tight font-bold sm:text-[2rem]">{title}</h1>
        {description && (
          <p className="max-w-[65ch] text-base leading-7 text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
          {actions}
        </div>
      )}
    </div>
  );
}
