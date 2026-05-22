import {
  Award,
  BookOpen,
  Gauge,
  Home,
  Menu,
  ShieldCheck,
  SlidersHorizontal,
  Wrench,
} from "lucide-react";
import { NavLink, useLocation } from "react-router";

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
import { useUiStore } from "@/stores/use-ui-store";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/dashboard", label: "Dashboard", icon: Gauge },
  { href: "/training", label: "Training", icon: BookOpen },
  { href: "/equipment", label: "Equipment", icon: Wrench },
  { href: "/badges", label: "Badges", icon: Award },
  { href: "/admin", label: "Admin", icon: SlidersHorizontal },
];

function NavList({ collapsed = false }: { collapsed?: boolean }) {
  const setMobileNavOpen = useUiStore((state) => state.setMobileNavOpen);

  return (
    <TooltipProvider delayDuration={100}>
      <nav className="grid gap-1">
        {navItems.map((item) => (
          <Tooltip key={item.href}>
            <TooltipTrigger asChild>
              <NavLink
                to={item.href}
                end={item.href === "/"}
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

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-screen shrink-0 border-r bg-card/70 p-3 transition-[width] lg:block",
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
            <div className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <ShieldCheck className="size-5" />
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">DolphinLMS</p>
                <p className="truncate text-xs text-muted-foreground">
                  FRC training
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

  const current = navItems.find((item) =>
    item.href === "/" ? location.pathname === "/" : location.pathname.startsWith(item.href),
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
            <SheetTitle>DolphinLMS</SheetTitle>
          </SheetHeader>
          <div className="px-4">
            <NavList />
          </div>
        </SheetContent>
      </Sheet>
      <div>
        <p className="text-xs text-muted-foreground">Section</p>
        <p className="text-sm font-semibold">{current?.label ?? "DolphinLMS"}</p>
      </div>
    </div>
  );
}
