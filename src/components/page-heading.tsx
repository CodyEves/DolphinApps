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
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-3xl space-y-1.5">
        <h1 className="text-[1.625rem] leading-tight font-semibold sm:text-[1.875rem]">{title}</h1>
        {description && (
          <p className="max-w-[65ch] text-[15px] leading-6 text-muted-foreground">{description}</p>
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
