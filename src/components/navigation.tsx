import { useConvexAuth } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import {
  Award,
  BadgePlus,
  BookOpen,
  ClipboardCheck,
  Factory,
  Gauge,
  ListTree,
  Menu,
  Package,
  Settings,
  ShoppingCart,
  SlidersHorizontal,
  Users,
  Wrench,
} from "lucide-react";
import { NavLink, useLocation } from "react-router";
import type { LucideIcon } from "lucide-react";

import { AppLauncher } from "@/components/app-launcher";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useProgramView } from "@/hooks/use-program-view";
import { useEffectiveRole } from "@/providers/role-preview-provider";
import { useUiStore } from "@/stores/use-ui-store";
import { cn } from "@/lib/utils";
import { api } from "@convex/_generated/api";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
  reviewOnly?: boolean;
};

const trainingNavItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: Gauge },
  { href: "/training", label: "Learning", icon: BookOpen },
  { href: "/equipment", label: "Equipment", icon: Wrench },
  { href: "/reviews", label: "Reviews", icon: ClipboardCheck, reviewOnly: true },
  { href: "/badges", label: "Badges", icon: Award },
];

const partsNavItems: NavItem[] = [
  { href: "/parts", label: "Parts", icon: Package },
  { href: "/parts/dashboard", label: "Dashboard", icon: Gauge },
  { href: "/parts/new", label: "Generate", icon: BadgePlus },
  { href: "/parts/bom", label: "BOM", icon: ListTree },
  { href: "/parts/manufacturing", label: "Manufacturing", icon: Factory },
  { href: "/parts/transmissions", label: "Transmissions", icon: Wrench },
  { href: "/parts/orders", label: "Orders", icon: ShoppingCart },
  { href: "/parts/admin", label: "Parts Admin", icon: Settings, adminOnly: true },
];

const managementNavItems: NavItem[] = [
  { href: "/management", label: "Overview", icon: SlidersHorizontal, adminOnly: true },
  { href: "/management/people", label: "People", icon: Users, adminOnly: true },
  { href: "/management/lms", label: "Training Admin", icon: BookOpen, adminOnly: true },
  { href: "/management/badges", label: "Badge Admin", icon: Award, adminOnly: true },
  { href: "/reviews", label: "Reviews", icon: ClipboardCheck, adminOnly: true },
  { href: "/parts/admin", label: "Parts Admin", icon: Settings, adminOnly: true },
];

function canReview(role: string) {
  return role === "admin" || role === "mentor" || role === "instructor";
}

function navItemsForPath(pathname: string) {
  if (pathname.startsWith("/management") || pathname.startsWith("/admin")) {
    return managementNavItems;
  }

  return pathname.startsWith("/parts") ? partsNavItems : trainingNavItems;
}

function visibleItems(items: NavItem[], role: string) {
  return items.filter(
    (item) =>
      (!item.adminOnly || role === "admin") &&
      (!item.reviewOnly || canReview(role)),
  );
}

function NavList({ collapsed = false }: { collapsed?: boolean }) {
  const setMobileNavOpen = useUiStore((state) => state.setMobileNavOpen);
  const location = useLocation();
  const { isAuthenticated } = useConvexAuth();
  const viewer = useQuery(api.profiles.viewer, isAuthenticated ? {} : "skip");
  const effectiveRole = useEffectiveRole(viewer?.profile.role);
  const visibleNavItems = visibleItems(navItemsForPath(location.pathname), effectiveRole);

  return (
    <TooltipProvider delayDuration={100}>
      <nav className="grid gap-1">
        {visibleNavItems.map((item) => (
          <Tooltip key={item.href}>
            <TooltipTrigger asChild>
              <NavLink
                to={item.href}
                end={item.href === "/" || item.href === "/parts"}
                onClick={() => setMobileNavOpen(false)}
                className={({ isActive }) =>
                  cn(
                    "flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium text-muted-foreground transition-all hover:bg-accent hover:text-accent-foreground",
                    collapsed && "mx-auto size-10 justify-center p-0",
                    isActive && "bg-accent text-accent-foreground shadow-sm shadow-brand-blue/10",
                  )
                }
              >
                <item.icon className="size-4" />
                {!collapsed && <span>{item.label}</span>}
              </NavLink>
            </TooltipTrigger>
            {collapsed && (
              <TooltipContent side="right">{item.label}</TooltipContent>
            )}
          </Tooltip>
        ))}
      </nav>
    </TooltipProvider>
  );
}

export function Sidebar() {
  const collapsed = useUiStore((state) => state.isSidebarCollapsed);
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-screen shrink-0 border-r bg-card/90 p-3 shadow-[0_0_40px_rgba(6,43,73,0.08)] backdrop-blur transition-[width] lg:block",
        collapsed ? "w-[4.5rem]" : "w-64",
      )}
    >
      <div className="flex h-full flex-col">
        <div className="flex h-12 items-center justify-between gap-2">
          <div
            className={cn(
              "flex min-w-0 flex-1",
              collapsed ? "justify-center" : "justify-start",
            )}
          >
            <AppLauncher collapsed={collapsed} />
          </div>
          {!collapsed && (
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSidebar}
              aria-label="Collapse sidebar"
            >
              <Menu className="size-4" />
            </Button>
          )}
        </div>
        <Separator className="my-3" />
        <NavList collapsed={collapsed} />
        {collapsed && (
          <Button
            variant="ghost"
            size="icon"
            className="mx-auto mt-3"
            onClick={toggleSidebar}
            aria-label="Expand sidebar"
          >
            <Menu className="size-4" />
          </Button>
        )}
      </div>
    </aside>
  );
}

export function MobileNav() {
  const isOpen = useUiStore((state) => state.isMobileNavOpen);
  const setOpen = useUiStore((state) => state.setMobileNavOpen);
  const location = useLocation();
  const { isAuthenticated } = useConvexAuth();
  const viewer = useQuery(api.profiles.viewer, isAuthenticated ? {} : "skip");
  const effectiveRole = useEffectiveRole(viewer?.profile.role);
  const { activeProgramMeta } = useProgramView();
  const appLabel = location.pathname.startsWith("/management") || location.pathname.startsWith("/admin")
    ? "Dolphin Management"
    : location.pathname.startsWith("/parts")
    ? activeProgramMeta.partsTitle
    : activeProgramMeta.trainingTitle;
  const visibleNavItems = visibleItems(navItemsForPath(location.pathname), effectiveRole);

  const current = visibleNavItems.find((item) =>
    item.href === "/" || item.href === "/parts"
      ? location.pathname === item.href
      : location.pathname.startsWith(item.href),
  );

  return (
    <div className="flex items-center gap-3 lg:hidden">
      <AppLauncher collapsed onSelect={() => setOpen(false)} />
      <Sheet open={isOpen} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" size="icon" aria-label="Open navigation">
            <Menu className="size-4" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-72">
          <SheetHeader>
            <SheetTitle>{appLabel}</SheetTitle>
          </SheetHeader>
          <div className="px-4">
            <NavList />
          </div>
        </SheetContent>
      </Sheet>
      <div>
        <p className="text-xs text-muted-foreground">{appLabel}</p>
        <p className="text-sm font-semibold">{current?.label ?? appLabel}</p>
      </div>
    </div>
  );
}
