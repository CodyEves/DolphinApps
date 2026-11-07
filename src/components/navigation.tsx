import { useConvexAuth } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import {
  Award,
  BatteryCharging,
  BookOpen,
  Clock,
  ClipboardCheck,
  ClipboardList,
  Download,
  Factory,
  FileCheck,
  Gauge,
  Menu,
  Monitor,
  Package,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Users,
  Wrench,
  CreditCard,
  LayoutGrid,
  PencilLine,
  UserCheck,
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
import { useProgramView } from "@/hooks/use-program-view";
import {
  canManageBadges,
  canOpenManagement,
  canEditLearning,
  canReviewLearning,
  isAdminRole,
} from "@/lib/role-access";
import { useEffectiveRole } from "@/providers/role-preview-provider";
import { useUiStore } from "@/stores/use-ui-store";
import { cn } from "@/lib/utils";
import { api } from "@convex/_generated/api";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
  badgeManagerOnly?: boolean;
  managementOnly?: boolean;
  reviewOnly?: boolean;
  learningEditorOnly?: boolean;
};

const trainingNavItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: Gauge },
  { href: "/training", label: "Learning", icon: BookOpen },
  { href: "/training/sign-offs", label: "Sign-offs", icon: UserCheck, reviewOnly: true },
  { href: "/training/team", label: "Team progress", icon: LayoutGrid, reviewOnly: true },
  { href: "/training/manage", label: "Edit skills", icon: PencilLine, learningEditorOnly: true },
  { href: "/reviews", label: "Reviews", icon: ClipboardCheck, reviewOnly: true },
  { href: "/badges", label: "Badges", icon: Award },
];

const toolsNavItems: NavItem[] = [
  { href: "/tools", label: "Tools", icon: Wrench },
  { href: "/tools/sign-offs", label: "Sign-offs", icon: ClipboardCheck, reviewOnly: true },
  { href: "/tools/readers", label: "Card readers", icon: CreditCard, adminOnly: true },
];

const partsNavItems: NavItem[] = [
  { href: "/parts", label: "Workspace", icon: Package },
  { href: "/parts/manufacturing", label: "Manufacturing", icon: Factory },
  { href: "/parts/admin", label: "Parts Admin", icon: Settings, adminOnly: true },
];

const managementNavItems: NavItem[] = [
  { href: "/management", label: "Overview", icon: SlidersHorizontal, managementOnly: true },
  { href: "/management/reviews", label: "Reviews", icon: ClipboardCheck, reviewOnly: true },
  { href: "/management/people", label: "People", icon: Users, adminOnly: true },
  { href: "/training/manage", label: "Learning skills", icon: BookOpen, learningEditorOnly: true },
  { href: "/management/lms", label: "Progress resets", icon: SlidersHorizontal, adminOnly: true },
  { href: "/management/badges", label: "Badge Admin", icon: Award, badgeManagerOnly: true },
  { href: "/training/team", label: "Team Progress", icon: ShieldCheck, managementOnly: true },
  { href: "/management/paperwork", label: "Paperwork", icon: FileCheck, managementOnly: true },
  { href: "/management/parts", label: "Parts Admin", icon: Settings, adminOnly: true },
];

const shopNavItems: NavItem[] = [
  { href: "/shop", label: "Overview", icon: Clock },
  { href: "/shop/display", label: "Display", icon: Monitor },
  { href: "/shop/records", label: "Records", icon: ClipboardList, managementOnly: true },
  { href: "/shop/review", label: "Review", icon: ShieldCheck, managementOnly: true },
  { href: "/shop/reports", label: "Reports", icon: Download, managementOnly: true },
];

const batteryNavItems: NavItem[] = [{ href: "/batteries", label: "Batteries", icon: BatteryCharging }];

function navItemsForPath(pathname: string) {
  if (pathname.startsWith("/batteries")) {
    return batteryNavItems;
  }

  if (pathname.startsWith("/management") || pathname.startsWith("/admin")) {
    return managementNavItems;
  }

  if (pathname.startsWith("/shop")) {
    return shopNavItems;
  }

  if (pathname.startsWith("/tools")) {
    return toolsNavItems;
  }

  return pathname.startsWith("/parts") ? partsNavItems : trainingNavItems;
}

const exactMatchHrefs = new Set(["/", "/parts", "/shop", "/tools", "/training"]);

/**
 * NavLink's className callback is lost when it sits inside a TooltipTrigger
 * (asChild merges className as a string), so active state is computed here.
 */
function isNavItemActive(pathname: string, href: string) {
  if (href === "/training") {
    return pathname === href || pathname.startsWith("/training/skills/") || pathname.startsWith("/training/labs/");
  }

  if (exactMatchHrefs.has(href)) {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function visibleItems(items: NavItem[], role: string) {
  return items.filter(
    (item) =>
      (!item.adminOnly || isAdminRole(role)) &&
      (!item.badgeManagerOnly || canManageBadges(role)) &&
      (!item.managementOnly || canOpenManagement(role)) &&
      (!item.reviewOnly || canReviewLearning(role)) &&
      (!item.learningEditorOnly || canEditLearning(role)),
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
                end={exactMatchHrefs.has(item.href)}
                onClick={() => setMobileNavOpen(false)}
                aria-current={isNavItemActive(location.pathname, item.href) ? "page" : undefined}
                className={cn(
                  "group rounded-md text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                  collapsed
                    ? "mx-auto flex size-10 items-center justify-center p-0"
                    : "flex h-9 w-full items-center justify-start gap-3 px-3",
                  isNavItemActive(location.pathname, item.href) &&
                    "bg-accent font-semibold text-foreground [&_svg]:text-primary",
                )}
              >
                <item.icon className="size-4 shrink-0" />
                {!collapsed && <span className="min-w-0 truncate">{item.label}</span>}
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

function appNameForPath(pathname: string, trainingTitle: string, partsTitle: string) {
  if (pathname.startsWith("/management") || pathname.startsWith("/admin")) {
    return "Management";
  }

  if (pathname.startsWith("/shop")) {
    return "Shop Attendance";
  }

  if (pathname.startsWith("/tools")) {
    return "Shop Tools";
  }

  if (pathname.startsWith("/batteries")) {
    return "Batteries";
  }

  if (pathname.startsWith("/parts")) {
    return partsTitle;
  }

  return trainingTitle;
}

function SidebarAppName() {
  const location = useLocation();
  const { activeProgramMeta } = useProgramView();

  return (
    <p className="min-w-0 flex-1 truncate px-3 font-heading text-base font-semibold [font-stretch:87.5%]">
      {appNameForPath(location.pathname, activeProgramMeta.trainingTitle, activeProgramMeta.partsTitle)}
    </p>
  );
}

export function Sidebar() {
  const collapsed = useUiStore((state) => state.isSidebarCollapsed);
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-screen shrink-0 border-r bg-card p-3 shadow-[1px_0_0_rgba(15,39,66,0.03)] transition-[width] lg:block",
        collapsed ? "w-[4.5rem]" : "w-64",
      )}
    >
      <div className="flex h-full flex-col">
        <div className="flex h-12 items-center justify-between gap-2">
          {!collapsed && (
            <SidebarAppName />
          )}
          <Button
            variant="ghost"
            size="icon"
            className={collapsed ? "mx-auto" : undefined}
            onClick={toggleSidebar}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <Menu className="size-4" />
          </Button>
        </div>
        <Separator className="my-2" />
        <NavList collapsed={collapsed} />
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
    ? "Management"
    : location.pathname.startsWith("/shop")
    ? "Shop Attendance"
    : location.pathname.startsWith("/tools")
    ? "Shop Tools"
    : location.pathname.startsWith("/parts")
    ? activeProgramMeta.partsTitle
    : activeProgramMeta.trainingTitle;
  const visibleNavItems = visibleItems(navItemsForPath(location.pathname), effectiveRole);

  const current = visibleNavItems.find((item) => isNavItemActive(location.pathname, item.href));

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
