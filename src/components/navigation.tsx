import { useConvexAuth } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import {
  Award,
  BadgePlus,
  BookOpen,
  ClipboardCheck,
  Factory,
  FishSymbol,
  Gauge,
  Home,
  ListTree,
  Menu,
  Package,
  Settings,
  ShoppingCart,
  SlidersHorizontal,
  Wrench,
} from "lucide-react";
import { NavLink, useLocation } from "react-router";
import type { LucideIcon } from "lucide-react";

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
  { href: "/", label: "Home", icon: Home },
  { href: "/dashboard", label: "Dashboard", icon: Gauge },
  { href: "/training", label: "Learning", icon: BookOpen },
  { href: "/equipment", label: "Equipment", icon: Wrench },
  { href: "/reviews", label: "Reviews", icon: ClipboardCheck, reviewOnly: true },
  { href: "/badges", label: "Badges", icon: Award },
  { href: "/admin", label: "Admin", icon: SlidersHorizontal, adminOnly: true },
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

function canReview(role: string) {
  return role === "admin" || role === "mentor" || role === "instructor";
}

function navItemsForPath(pathname: string) {
  return pathname.startsWith("/parts") ? partsNavItems : trainingNavItems;
}

function appLabelForPath(pathname: string) {
  return pathname.startsWith("/parts") ? "Dolphin Parts" : "Dolphin Training";
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
                    "flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
                    collapsed && "justify-center px-2",
                    isActive && "bg-accent text-accent-foreground",
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
  const location = useLocation();
  const appLabel = appLabelForPath(location.pathname);

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-screen shrink-0 border-r bg-card/85 p-3 shadow-[0_0_40px_rgba(14,165,233,0.08)] backdrop-blur transition-[width] lg:block",
        collapsed ? "w-18" : "w-64",
      )}
    >
      <div className="flex h-full flex-col">
        <div className="flex h-12 items-center justify-between gap-2">
          <div
            className={cn(
              "flex min-w-0 items-center gap-2",
              collapsed && "justify-center",
            )}
          >
            <div className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-[0_0_24px_rgba(56,189,248,0.35)]">
              <FishSymbol className="size-5" />
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{appLabel}</p>
                <p className="truncate text-xs text-muted-foreground">
                  Dolphin Apps
                </p>
              </div>
            )}
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
            className="mt-3"
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
  const appLabel = appLabelForPath(location.pathname);
  const visibleNavItems = visibleItems(navItemsForPath(location.pathname), effectiveRole);

  const current = visibleNavItems.find((item) =>
    item.href === "/" || item.href === "/parts"
      ? location.pathname === item.href
      : location.pathname.startsWith(item.href),
  );

  return (
    <div className="flex items-center gap-3 lg:hidden">
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
