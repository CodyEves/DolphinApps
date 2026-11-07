import {
  BookOpen,
  Calculator,
  CircleAlert,
  CircleCheck,
  Circle,
  CirclePlay,
  Cog,
  Compass,
  GraduationCap,
  Hourglass,
  ListChecks,
  Megaphone,
  MousePointerClick,
  PenTool,
  UserCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export type CheckType = "self" | "quiz" | "mentor";
export type SkillStatus = "completed" | "signoff_requested" | "needs_work" | null;
export type PathColor = "blue" | "amber" | "violet" | "teal" | "rose";
export type ResourceKind = "interactive" | "video" | "reading" | "course" | "tool";

export const pathColors: Record<
  PathColor,
  { soft: string; text: string; bar: string; ring: string; dot: string; label: string }
> = {
  blue: {
    soft: "bg-sky-50 dark:bg-sky-950/40",
    text: "text-sky-800 dark:text-sky-200",
    bar: "bg-sky-600 dark:bg-sky-400",
    ring: "ring-sky-600/30 dark:ring-sky-400/30",
    dot: "bg-sky-600 dark:bg-sky-400",
    label: "Blue",
  },
  amber: {
    soft: "bg-amber-50 dark:bg-amber-950/40",
    text: "text-amber-900 dark:text-amber-200",
    bar: "bg-amber-500 dark:bg-amber-400",
    ring: "ring-amber-500/30 dark:ring-amber-400/30",
    dot: "bg-amber-500 dark:bg-amber-400",
    label: "Amber",
  },
  violet: {
    soft: "bg-violet-50 dark:bg-violet-950/40",
    text: "text-violet-800 dark:text-violet-200",
    bar: "bg-violet-600 dark:bg-violet-400",
    ring: "ring-violet-600/30 dark:ring-violet-400/30",
    dot: "bg-violet-600 dark:bg-violet-400",
    label: "Violet",
  },
  teal: {
    soft: "bg-teal-50 dark:bg-teal-950/40",
    text: "text-teal-800 dark:text-teal-200",
    bar: "bg-teal-600 dark:bg-teal-400",
    ring: "ring-teal-600/30 dark:ring-teal-400/30",
    dot: "bg-teal-600 dark:bg-teal-400",
    label: "Teal",
  },
  rose: {
    soft: "bg-rose-50 dark:bg-rose-950/40",
    text: "text-rose-800 dark:text-rose-200",
    bar: "bg-rose-600 dark:bg-rose-400",
    ring: "ring-rose-600/30 dark:ring-rose-400/30",
    dot: "bg-rose-600 dark:bg-rose-400",
    label: "Rose",
  },
};

export function pathIcon(slug: string): LucideIcon {
  if (slug.startsWith("electrical")) {
    return Cog;
  }

  if (slug.startsWith("business")) {
    return Megaphone;
  }

  if (slug.startsWith("mechanical")) {
    return PenTool;
  }

  return Compass;
}

export const checkTypeMeta: Record<CheckType, { label: string; icon: LucideIcon; hint: string }> = {
  self: {
    label: "Self-check",
    icon: CircleCheck,
    hint: "Mark it done when you can do it without help.",
  },
  quiz: {
    label: "Quiz",
    icon: ListChecks,
    hint: "Pass a short quiz to complete it.",
  },
  mentor: {
    label: "Mentor sign-off",
    icon: UserCheck,
    hint: "Show a mentor in class, or send your work for review.",
  },
};

export function statusMeta(status: SkillStatus, checkType: CheckType) {
  switch (status) {
    case "completed":
      return {
        label: checkType === "mentor" ? "Signed off" : "Done",
        icon: CircleCheck,
        className:
          "border-emerald-600/25 bg-emerald-50 text-emerald-800 dark:border-emerald-400/25 dark:bg-emerald-950/40 dark:text-emerald-200",
      };
    case "signoff_requested":
      return {
        label: "Waiting for mentor",
        icon: Hourglass,
        className:
          "border-amber-500/30 bg-amber-50 text-amber-900 dark:border-amber-400/30 dark:bg-amber-950/40 dark:text-amber-200",
      };
    case "needs_work":
      return {
        label: "Needs work",
        icon: CircleAlert,
        className:
          "border-rose-500/30 bg-rose-50 text-rose-800 dark:border-rose-400/30 dark:bg-rose-950/40 dark:text-rose-200",
      };
    default:
      return {
        label: "Not started",
        icon: Circle,
        className: "border-border bg-card text-muted-foreground",
      };
  }
}

export function StatusPill({ status, checkType }: { status: SkillStatus; checkType: CheckType }) {
  const meta = statusMeta(status, checkType);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        meta.className,
      )}
    >
      <meta.icon className="size-3.5" aria-hidden />
      {meta.label}
    </span>
  );
}

export function CheckTypeLabel({ checkType, className }: { checkType: CheckType; className?: string }) {
  const meta = checkTypeMeta[checkType];

  return (
    <span className={cn("inline-flex items-center gap-1 text-xs text-muted-foreground", className)}>
      <meta.icon className="size-3.5" aria-hidden />
      {meta.label}
    </span>
  );
}

export const resourceKindMeta: Record<ResourceKind, { label: string; icon: LucideIcon }> = {
  interactive: { label: "Interactive", icon: MousePointerClick },
  video: { label: "Video", icon: CirclePlay },
  reading: { label: "Reading", icon: BookOpen },
  course: { label: "Course", icon: GraduationCap },
  tool: { label: "Tool", icon: Calculator },
};

export function formatMinutes(minutes: number) {
  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`;
}

export function formatShortDate(timestamp: number | undefined) {
  if (!timestamp) {
    return "";
  }

  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(timestamp));
}

/** Groups items by stage while keeping the order the stages first appear in. */
export function groupByStage<T extends { stage: string }>(items: T[]) {
  const groups: { stage: string; items: T[] }[] = [];

  for (const item of items) {
    const group = groups.find((entry) => entry.stage === item.stage);

    if (group) {
      group.items.push(item);
    } else {
      groups.push({ stage: item.stage, items: [item] });
    }
  }

  return groups;
}
