import {
  BatteryCharging,
  CalendarDays,
  ChevronDown,
  Clock,
  GraduationCap,
  Grid3X3,
  Home,
  Package,
  Settings,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { useConvexAuth } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import { Link, useLocation } from "react-router";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useProgramView } from "@/hooks/use-program-view";
import { canOpenManagement } from "@/lib/role-access";
import { useEffectiveRole } from "@/providers/role-preview-provider";
import { cn } from "@/lib/utils";
import { api } from "@convex/_generated/api";

type AppLauncherProps = {
  collapsed?: boolean;
  /** Top-bar style: a ghost button reading "Apps" (icon only on small screens). */
  labelled?: boolean;
  onSelect?: () => void;
};

type LauncherApp = {
  href: string;
  titleKey?: "trainingTitle" | "partsTitle";
  title?: string;
  description: string;
  icon: LucideIcon;
  managementOnly?: boolean;
};

const apps: LauncherApp[] = [
  {
    href: "/",
    title: "All apps",
    description: "Today and every app",
    icon: Home,
  },
  {
    href: "/dashboard",
    titleKey: "trainingTitle",
    description: "Lessons, safety, badges",
    icon: GraduationCap,
  },
  {
    href: "/tools",
    title: "Shop Tools",
    description: "SOPs, sign-offs, readers",
    icon: Wrench,
  },
  {
    href: "/parts",
    titleKey: "partsTitle",
    description: "Parts, BOMs, fab",
    icon: Package,
  },
  {
    href: "/shop",
    title: "Shop Attendance",
    description: "Sign-ins, hours",
    icon: Clock,
  },
  {
    href: "/batteries",
    title: "Batteries",
    description: "Uses, Beak, analyzer",
    icon: BatteryCharging,
  },
  {
    href: "/interviews",
    title: "Interviews",
    description: "Schedule tryout interviews",
    icon: CalendarDays,
    managementOnly: true,
  },
  {
    href: "/management",
    titleKey: "trainingTitle",
    title: "Management",
    description: "Reviews, badges, team admin",
    icon: Settings,
    managementOnly: true,
  },
];

function isActiveApp(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  if (href === "/management") {
    return pathname.startsWith("/management") || pathname.startsWith("/admin");
  }

  if (href === "/parts") {
    return pathname.startsWith("/parts");
  }

  if (href === "/tools") {
    return pathname.startsWith("/tools");
  }

  if (href === "/shop") {
    return pathname.startsWith("/shop");
  }

  if (href === "/batteries") {
    return pathname.startsWith("/batteries");
  }

  if (href === "/interviews") {
    return pathname.startsWith("/interviews");
  }

  return (
    pathname !== "/" &&
    !pathname.startsWith("/batteries") &&
    !pathname.startsWith("/interviews") &&
    !pathname.startsWith("/parts") &&
    !pathname.startsWith("/shop") &&
    !pathname.startsWith("/auth") &&
    !pathname.startsWith("/tools") &&
    !pathname.startsWith("/management") &&
    !pathname.startsWith("/admin")
  );
}

export function AppLauncher({ collapsed = false, labelled = false, onSelect }: AppLauncherProps) {
  const location = useLocation();
  const { isAuthenticated } = useConvexAuth();
  const viewer = useQuery(api.profiles.viewer, isAuthenticated ? {} : "skip");
  const effectiveRole = useEffectiveRole(viewer?.profile.role);
  const { activeProgramMeta } = useProgramView();
  const visibleApps =
    effectiveRole === "kiosk"
      ? apps
          .filter((app) => app.href === "/shop")
          .map((app) => ({
            ...app,
            href: "/shop/display",
            description: "Display code",
          }))
      : apps.filter((app) => !app.managementOnly || canOpenManagement(effectiveRole));
  const activeApp =
    visibleApps.find((app) => isActiveApp(location.pathname, app.href)) ?? visibleApps[0];
  const activeAppName = activeApp.title ?? activeProgramMeta[activeApp.titleKey ?? "trainingTitle"];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {labelled ? (
          <button
            type="button"
            className="group flex h-10 min-w-0 items-center gap-1.5 rounded-[10px] px-2.5 text-[15px] font-semibold text-white outline-none transition-colors hover:bg-white/12 focus-visible:ring-[3px] focus-visible:ring-white/50 data-[state=open]:bg-white/15"
            aria-label={`Current app: ${activeAppName}. Switch app`}
          >
            <span className="truncate">{activeAppName}</span>
            <ChevronDown className="size-4 shrink-0 text-white/70 transition-transform group-data-[state=open]:rotate-180" aria-hidden />
          </button>
        ) : (
          <Button
            type="button"
            variant="ghost"
            className={cn(
              "h-12 justify-start gap-2 px-0 hover:bg-transparent",
              collapsed && "size-10 justify-center p-0",
            )}
            aria-label="Open Dolphin apps"
          >
            <span className="flex size-9 items-center justify-center rounded-lg border bg-card text-foreground">
              <Grid3X3 className="size-4" />
            </span>
            {!collapsed && (
              <span className="min-w-0 text-left">
                <span className="block truncate text-sm font-semibold">
                  {activeAppName}
                </span>
                <span className="block truncate text-xs font-normal text-muted-foreground">
                  Apps
                </span>
              </span>
            )}
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={8}
        className="w-[calc(100vw-1.5rem)] max-w-[22rem] p-1.5"
      >
        <div className="grid grid-cols-2 gap-1">
          {visibleApps.map((app) => {
            const Icon = app.icon;
            const isActive = isActiveApp(location.pathname, app.href);
            const title = app.title ?? activeProgramMeta[app.titleKey ?? "trainingTitle"];

            return (
              <Link
                key={app.href}
                to={app.href}
                onClick={onSelect}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "group flex min-h-[5.5rem] flex-col items-start justify-between gap-3 rounded-[8px] p-3 text-left outline-none transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50",
                  isActive && "bg-accent text-accent-foreground",
                )}
              >
                <span
                  className={cn(
                    "grid size-9 place-items-center rounded-[8px]",
                    isActive ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary dark:bg-primary/15",
                  )}
                >
                  <Icon className="size-[18px]" aria-hidden />
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
