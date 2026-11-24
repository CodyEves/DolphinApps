import { useConvexAuth } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import {
  Award,
  BatteryCharging,
  BookOpen,
  BookOpenCheck,
  MessageSquareText,
  Clock,
  ClipboardCheck,
  ClipboardList,
  CalendarClock,
  CalendarDays,
  Download,
  Factory,
  FileCheck,
  Gauge,
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

import { useProgramView } from "@/hooks/use-program-view";
import {
  canManageBadges,
  canOpenManagement,
  canEditLearning,
  canReviewLearning,
  isAdminRole,
} from "@/lib/role-access";
import { useEffectiveRole } from "@/providers/role-preview-provider";
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

const sopNavItems: NavItem[] = [
  { href: "/SOP", label: "Catalog", icon: BookOpenCheck },
  { href: "/SOP/suggestions", label: "Suggestions", icon: MessageSquareText, reviewOnly: true },
];

/** The SOP book lives at /SOP; React Router matches it in any letter case. */
function isSopPath(pathname: string) {
  const lower = pathname.toLowerCase();

  return lower === "/sop" || lower.startsWith("/sop/");
}

function navItemsForPath(pathname: string) {
  if (isSopPath(pathname)) {
    return sopNavItems;
  }

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
  if (isSopPath(pathname)) {
    const onSuggestions = pathname.toLowerCase().startsWith("/sop/suggestions");

    return href === "/SOP/suggestions" ? onSuggestions : href === "/SOP" && !onSuggestions;
  }

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

function appNameForPath(pathname: string, trainingTitle: string, partsTitle: string) {
  if (isSopPath(pathname)) {
    return "SOP Book";
  }

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

/** The current app's name and page, for the app bar and page tabs. */
export function useAppLocation() {
  const location = useLocation();
  const { activeProgramMeta } = useProgramView();
  const items = useVisibleNavItems();
  const appName = appNameForPath(location.pathname, activeProgramMeta.trainingTitle, activeProgramMeta.partsTitle);
  const current = items.find((item) => isNavItemActive(location.pathname, item.href));

  return { appName, pageName: current?.label ?? null, teamNumber: activeProgramMeta.teamNumber };
}

function TabLink({ item }: { item: NavItem }) {
  const location = useLocation();
  const isActive = isNavItemActive(location.pathname, item.href);

  return (
    <NavLink
      to={item.href}
      end={exactMatchHrefs.has(item.href)}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "relative flex h-12 shrink-0 items-center gap-2 rounded-t-md px-3 text-sm font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:bg-accent",
        "after:absolute after:inset-x-2 after:bottom-0 after:h-[3px] after:rounded-t-full after:bg-transparent after:transition-colors",
        isActive && "font-semibold text-primary after:bg-primary hover:text-primary dark:text-foreground",
      )}
    >
      <item.icon className="size-4 shrink-0" aria-hidden />
      {item.label}
    </NavLink>
  );
}

/**
 * The pages of the current app, as a row of tabs under the app bar. Everyday
 * pages come first; mentor and admin pages follow a divider so students never
 * wonder why a link is there. Scrolls sideways on small screens.
 */
export function PageTabs() {
  const items = useVisibleNavItems();
  const everyday = items.filter((item) => !isRestricted(item));
  const staff = items.filter(isRestricted);
  const showDivider = everyday.length > 0 && staff.length > 0;

  if (items.length <= 1) {
    return null;
  }

  return (
    <nav aria-label="Pages in this app" className="border-b bg-card">
      <div className="scrollbar-none mx-auto flex max-w-[75rem] items-stretch overflow-x-auto px-1 sm:px-3">
        {everyday.map((item) => (
          <TabLink key={item.href} item={item} />
        ))}
        {showDivider && (
          <span className="mx-2 flex shrink-0 items-center gap-2" aria-hidden>
            <span className="h-5 w-px bg-border" />
            <span className="text-xs font-medium text-muted-foreground">Mentor</span>
          </span>
        )}
        {staff.map((item) => (
          <TabLink key={item.href} item={item} />
        ))}
      </div>
    </nav>
  );
}
