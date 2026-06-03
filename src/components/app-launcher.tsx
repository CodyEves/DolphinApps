import {
  GraduationCap,
  Grid3X3,
  Package,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { useConvexAuth } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import { Link, useLocation } from "react-router";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useProgramView } from "@/hooks/use-program-view";
import { useEffectiveRole } from "@/providers/role-preview-provider";
import { cn } from "@/lib/utils";
import { api } from "@convex/_generated/api";

type AppLauncherProps = {
  collapsed?: boolean;
  onSelect?: () => void;
};

type LauncherApp = {
  href: string;
  titleKey: "trainingTitle" | "partsTitle";
  title?: string;
  description: string;
  icon: LucideIcon;
  iconClassName: string;
};

const apps: LauncherApp[] = [
  {
    href: "/dashboard",
    titleKey: "trainingTitle",
    description: "Lessons, safety, badges",
    icon: GraduationCap,
    iconClassName: "bg-brand-blue text-white",
  },
  {
    href: "/parts",
    titleKey: "partsTitle",
    description: "Parts, BOMs, fab",
    icon: Package,
    iconClassName: "bg-brand-orange text-white",
  },
  {
    href: "/management",
    titleKey: "trainingTitle",
    title: "Dolphin Management",
    description: "Accounts, rosters, admin",
    icon: Settings,
    iconClassName: "bg-brand-navy text-white",
  },
];

function isActiveApp(pathname: string, href: string) {
  if (href === "/management") {
    return pathname.startsWith("/management") || pathname.startsWith("/admin");
  }

  if (href === "/parts") {
    return pathname.startsWith("/parts");
  }

  return pathname !== "/" && !pathname.startsWith("/parts") && !pathname.startsWith("/management") && !pathname.startsWith("/admin");
}

export function AppLauncher({ collapsed = false, onSelect }: AppLauncherProps) {
  const location = useLocation();
  const { isAuthenticated } = useConvexAuth();
  const viewer = useQuery(api.profiles.viewer, isAuthenticated ? {} : "skip");
  const effectiveRole = useEffectiveRole(viewer?.profile.role);
  const { activeProgramMeta } = useProgramView();
  const visibleApps = apps.filter((app) => app.href !== "/management" || effectiveRole === "admin");
  const activeApp =
    visibleApps.find((app) => isActiveApp(location.pathname, app.href)) ?? visibleApps[0];
  const activeAppName = activeApp.title ?? activeProgramMeta[activeApp.titleKey];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className={cn(
            "h-12 justify-start gap-2 px-0 hover:bg-transparent",
            collapsed && "size-10 justify-center p-0",
          )}
          aria-label="Open Dolphin apps"
        >
          <span className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-[0_0_24px_rgba(56,189,248,0.35)]">
            <Grid3X3 className="size-5" />
          </span>
          {!collapsed && (
            <span className="min-w-0 text-left">
              <span className="block truncate text-sm font-semibold">
                {activeAppName}
              </span>
              <span className="block truncate text-xs font-normal text-muted-foreground">
                Dolphin Apps
              </span>
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={8} className="w-80 p-3">
        <DropdownMenuLabel className="px-1 pb-2 pt-0 text-xs text-muted-foreground">
          Dolphin apps
        </DropdownMenuLabel>
        <div className="grid grid-cols-2 gap-2">
          {visibleApps.map((app) => {
            const Icon = app.icon;
            const isActive = isActiveApp(location.pathname, app.href);
            const title = app.title ?? activeProgramMeta[app.titleKey];

            return (
              <Link
                key={app.href}
                to={app.href}
                onClick={onSelect}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "group grid min-h-28 place-items-center gap-2 rounded-md border border-transparent p-3 text-center outline-none transition-all hover:border-brand-aqua/30 hover:bg-accent focus-visible:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50",
                  isActive && "border-brand-aqua/40 bg-accent text-accent-foreground shadow-sm",
                )}
              >
                <span
                  className={cn(
                    "grid size-12 place-items-center rounded-md shadow-sm",
                    app.iconClassName,
                  )}
                >
                  <Icon className="size-6" />
                </span>
                <span className="grid gap-0.5">
                  <span className="text-sm font-medium leading-5">
                    {title}
                  </span>
                  <span className="text-xs leading-4 text-muted-foreground">
                    {app.description}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
