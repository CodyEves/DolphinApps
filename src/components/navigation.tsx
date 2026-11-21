import { useConvexAuth } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import {
  Award,
  BatteryCharging,
  BookOpen,
  Clock,
  ClipboardCheck,
  ClipboardList,
  CalendarClock,
  CalendarDays,
  Download,
  Factory,
  FileCheck,
  Gauge,
  Menu,
  Monitor,
  PanelLeftClose,
  PanelLeftOpen,
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
import { Link, NavLink, useLocation } from "react-router";
import type { LucideIcon } from "lucide-react";

import { TeamPlate } from "@/components/team-plate";
import { Button } from "@/components/ui/button";
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

const interviewNavItems: NavItem[] = [
  { href: "/interviews", label: "Scheduling board", icon: CalendarDays },
  { href: "/interviews/mentor", label: "Mentor schedule", icon: Users },
  { href: "/interviews/schedule", label: "Posted schedule", icon: CalendarClock },
];

const batteryNavItems: NavItem[] = [{ href: "/batteries", label: "Batteries", icon: BatteryCharging }];

function navItemsForPath(pathname: string) {
  if (pathname.startsWith("/batteries")) {
    return batteryNavItems;
  }

  if (pathname.startsWith("/interviews")) {
    return interviewNavItems;
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

const exactMatchHrefs = new Set(["/", "/parts", "/shop", "/tools", "/training", "/interviews"]);

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

function isRestricted(item: NavItem) {
  return Boolean(
    item.adminOnly || item.badgeManagerOnly || item.managementOnly || item.reviewOnly || item.learningEditorOnly,
  );
}

function useVisibleNavItems() {
  const location = useLocation();
  const { isAuthenticated } = useConvexAuth();
  const viewer = useQuery(api.profiles.viewer, isAuthenticated ? {} : "skip");
  const effectiveRole = useEffectiveRole(viewer?.profile.role);

  return visibleItems(navItemsForPath(location.pathname), effectiveRole);
}

function NavItemLink({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const setMobileNavOpen = useUiStore((state) => state.setMobileNavOpen);
  const location = useLocation();
  const isActive = isNavItemActive(location.pathname, item.href);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <NavLink
          to={item.href}
          end={exactMatchHrefs.has(item.href)}
          onClick={() => setMobileNavOpen(false)}
          aria-current={isActive ? "page" : undefined}
          aria-label={collapsed ? item.label : undefined}
          className={cn(
            "group relative rounded-md text-sm font-medium text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50",
            collapsed
              ? "mx-auto flex size-10 items-center justify-center p-0"
              : "flex h-9 w-full items-center justify-start gap-3 px-3",
            isActive &&
              "bg-accent font-semibold text-foreground [&_svg]:text-primary before:absolute before:inset-y-2 before:left-0 before:w-[3px] before:rounded-full before:bg-primary",
          )}
        >
          <item.icon className="size-4 shrink-0" aria-hidden />
          {!collapsed && <span className="min-w-0 truncate">{item.label}</span>}
        </NavLink>
      </TooltipTrigger>
      {collapsed && <TooltipContent side="right">{item.label}</TooltipContent>}
    </Tooltip>
  );
}

/**
 * Everyday items first. Mentor and admin items sit in their own labelled group
 * so students never wonder why a link is there, and staff can find their tools.
 */
function NavList({ collapsed = false }: { collapsed?: boolean }) {
  const items = useVisibleNavItems();
  const everyday = items.filter((item) => !isRestricted(item));
  const staff = items.filter(isRestricted);
  const showGroups = everyday.length > 0 && staff.length > 0;

  return (
    <TooltipProvider delayDuration={100}>
      <nav aria-label="App pages" className="grid gap-5">
        {everyday.length > 0 && (
          <ul className="grid gap-0.5">
            {everyday.map((item) => (
              <li key={item.href}>
                <NavItemLink item={item} collapsed={collapsed} />
              </li>
            ))}
          </ul>
        )}
        {staff.length > 0 && (
          <div className="grid gap-1.5">
            {showGroups &&
              (collapsed ? (
                <span aria-hidden className="mx-auto h-px w-6 bg-border" />
              ) : (
                <p className="px-3 text-xs font-medium text-muted-foreground">Mentor tools</p>
              ))}
            <ul className="grid gap-0.5" aria-label={showGroups ? "Mentor tools" : undefined}>
              {staff.map((item) => (
                <li key={item.href}>
                  <NavItemLink item={item} collapsed={collapsed} />
                </li>
              ))}
            </ul>
          </div>
        )}
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

  if (pathname.startsWith("/interviews")) {
    return "Interviews";
  }

  if (pathname.startsWith("/parts")) {
    return partsTitle;
  }

  return trainingTitle;
}

/** The current app's name and page, for the sidebar title and the top bar. */
export function useAppLocation() {
  const location = useLocation();
  const { activeProgramMeta } = useProgramView();
  const items = useVisibleNavItems();
  const appName = appNameForPath(location.pathname, activeProgramMeta.trainingTitle, activeProgramMeta.partsTitle);
  const current = items.find((item) => isNavItemActive(location.pathname, item.href));

  return { appName, pageName: current?.label ?? null, teamNumber: activeProgramMeta.teamNumber };
}

function HomeLink({ collapsed }: { collapsed: boolean }) {
  const { teamNumber } = useAppLocation();

  return (
    <Link
      to="/"
      aria-label="Dolphin Apps home"
      className={cn(
        "flex items-center gap-2.5 rounded-md text-sm font-semibold text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50",
        collapsed ? "mx-auto justify-center" : "px-2 py-1",
      )}
    >
      <TeamPlate number={teamNumber} size="sm" />
      {!collapsed && <span>Dolphin Apps</span>}
    </Link>
  );
}

export function Sidebar() {
  const collapsed = useUiStore((state) => state.isSidebarCollapsed);
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);
  const { appName } = useAppLocation();

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-screen shrink-0 border-r bg-card transition-[width] duration-200 lg:block",
        collapsed ? "w-[4.5rem]" : "w-60",
      )}
    >
      <div className="flex h-full flex-col px-3 pb-3">
        <div className="-mx-3 flex h-14 shrink-0 items-center border-b px-3">
          <HomeLink collapsed={collapsed} />
        </div>
        {!collapsed && (
          <p className="truncate px-3 pt-5 pb-3 font-heading text-lg leading-6 font-bold [font-stretch:87.5%]">
            {appName}
          </p>
        )}
        <div className={cn("min-h-0 flex-1 overflow-y-auto", collapsed && "pt-4")}>
          <NavList collapsed={collapsed} />
        </div>
        <Button
          variant="ghost"
          size={collapsed ? "icon" : "sm"}
          className={cn("text-muted-foreground", collapsed ? "mx-auto" : "justify-start gap-3 px-3")}
          onClick={toggleSidebar}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
          {!collapsed && <span className="font-medium">Collapse</span>}
        </Button>
      </div>
    </aside>
  );
}

export function MobileNav() {
  const isOpen = useUiStore((state) => state.isMobileNavOpen);
  const setOpen = useUiStore((state) => state.setMobileNavOpen);
  const { appName, pageName } = useAppLocation();

  return (
    <div className="flex min-w-0 items-center gap-3 lg:hidden">
      <Sheet open={isOpen} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Open navigation">
            <Menu className="size-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-72 gap-0">
          <SheetHeader className="gap-3 border-b pb-4">
            <HomeLink collapsed={false} />
            <SheetTitle className="px-2 font-heading text-lg [font-stretch:87.5%]">{appName}</SheetTitle>
          </SheetHeader>
          <div className="overflow-y-auto px-3 py-4">
            <NavList />
          </div>
        </SheetContent>
      </Sheet>
      <div className="min-w-0">
        <p className="truncate text-xs text-muted-foreground">{appName}</p>
        <p className="truncate text-sm font-semibold">{pageName ?? appName}</p>
      </div>
    </div>
  );
}
