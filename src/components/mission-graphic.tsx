import {
  Award,
  Bot,
  CircuitBoard,
  ClipboardCheck,
  Rocket,
  Waves,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

type MissionGraphicVariant = "learning" | "team" | "track" | "celebration";

const variantConfig: Record<
  MissionGraphicVariant,
  {
    icon: LucideIcon;
    supportIcon: LucideIcon;
    badge: string;
    accent: string;
    secondary: string;
  }
> = {
  learning: {
    icon: Rocket,
    supportIcon: CircuitBoard,
    badge: "NEXT",
    accent: "bg-brand-orange text-white",
    secondary: "bg-brand-aqua/15 text-brand-navy dark:text-foreground",
  },
  team: {
    icon: ClipboardCheck,
    supportIcon: Bot,
    badge: "TEAM",
    accent: "bg-brand-blue text-white",
    secondary: "bg-brand-orange/15 text-brand-navy dark:text-foreground",
  },
  track: {
    icon: CircuitBoard,
    supportIcon: Rocket,
    badge: "PATH",
    accent: "bg-brand-aqua text-brand-navy",
    secondary: "bg-brand-blue/15 text-brand-navy dark:text-foreground",
  },
  celebration: {
    icon: Award,
    supportIcon: Waves,
    badge: "DONE",
    accent: "bg-primary text-primary-foreground",
    secondary: "bg-brand-orange/15 text-brand-navy dark:text-foreground",
  },
};

export function MissionGraphic({
  variant = "learning",
  className,
}: {
  variant?: MissionGraphicVariant;
  className?: string;
}) {
  const config = variantConfig[variant];
  const Icon = config.icon;
  const SupportIcon = config.supportIcon;

  return (
    <div
      aria-hidden="true"
      className={cn(
        "relative hidden min-h-44 overflow-hidden rounded-md border bg-muted/30 p-4 shadow-inner lg:block",
        className,
      )}
    >
      <div className="absolute inset-0 bg-[linear-gradient(90deg,color-mix(in_srgb,var(--border)_45%,transparent)_1px,transparent_1px),linear-gradient(180deg,color-mix(in_srgb,var(--border)_45%,transparent)_1px,transparent_1px)] bg-[size:22px_22px]" />
      <div className="absolute inset-x-0 bottom-0 h-20 bg-[repeating-linear-gradient(135deg,color-mix(in_srgb,var(--brand-aqua)_16%,transparent)_0_8px,transparent_8px_18px)]" />
      <div className="relative z-10 flex h-full flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="rounded-md border bg-card/90 px-2 py-1 text-[11px] font-semibold tracking-wider text-muted-foreground">
            {config.badge}
          </span>
          <span className={cn("grid size-10 place-items-center rounded-md", config.secondary)}>
            <SupportIcon className="size-5" />
          </span>
        </div>

        <div className="grid place-items-center py-2">
          <div className="relative">
            <div className="absolute -left-12 top-1/2 h-1 w-10 -translate-y-1/2 rounded-full bg-brand-aqua/60" />
            <div className="absolute -right-12 top-1/2 h-1 w-10 -translate-y-1/2 rounded-full bg-brand-orange/70" />
            <div className="absolute -top-8 left-1/2 h-7 w-1 -translate-x-1/2 rounded-full bg-brand-blue/50" />
            <span className={cn("grid size-20 place-items-center rounded-md shadow-lg", config.accent)}>
              <Icon className="size-10" />
            </span>
          </div>
        </div>

        <div className="grid grid-cols-5 gap-2">
          {[0, 1, 2, 3, 4].map((index) => (
            <span
              key={index}
              className={cn(
                "h-2 rounded-sm",
                index % 2 === 0 ? "bg-primary/65" : "bg-brand-orange/75",
              )}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
