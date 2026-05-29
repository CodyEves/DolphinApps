import {
  FishSymbol,
  GraduationCap,
  Package,
  type LucideIcon,
} from "lucide-react";
import { Link, useLocation } from "react-router";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type AppLauncherProps = {
  collapsed?: boolean;
  onSelect?: () => void;
};

type LauncherApp = {
  href: string;
  name: string;
  description: string;
  icon: LucideIcon;
  iconClassName: string;
};

const apps: LauncherApp[] = [
  {
    href: "/",
    name: "Dolphin Training",
    description: "Lessons, safety, badges",
    icon: GraduationCap,
    iconClassName: "bg-emerald-600 text-white",
  },
  {
    href: "/parts",
    name: "Dolphin Parts",
    description: "Parts, BOMs, fab",
    icon: Package,
    iconClassName: "bg-cyan-600 text-white",
  },
];

function isActiveApp(pathname: string, href: string) {
  if (href === "/parts") {
    return pathname.startsWith("/parts");
  }

  return !pathname.startsWith("/parts");
}

export function AppLauncher({ collapsed = false, onSelect }: AppLauncherProps) {
  const location = useLocation();
  const activeApp =
    apps.find((app) => isActiveApp(location.pathname, app.href)) ?? apps[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className={cn(
            "h-12 justify-start gap-2 px-0 hover:bg-transparent",
            collapsed && "w-full justify-center",
          )}
          aria-label="Open Dolphin apps"
        >
          <span className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-[0_0_24px_rgba(56,189,248,0.35)]">
            <FishSymbol className="size-5" />
          </span>
          {!collapsed && (
            <span className="min-w-0 text-left">
              <span className="block truncate text-sm font-semibold">
                {activeApp.name}
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
          {apps.map((app) => {
            const Icon = app.icon;
            const isActive = isActiveApp(location.pathname, app.href);

            return (
              <Link
                key={app.href}
                to={app.href}
                onClick={onSelect}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "group grid min-h-28 place-items-center gap-2 rounded-md p-3 text-center outline-none transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50",
                  isActive && "bg-accent text-accent-foreground",
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
                    {app.name}
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
