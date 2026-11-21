import { Suspense } from "react";
import { Link, Navigate, Outlet, useLocation } from "react-router";

import { AppLauncher } from "@/components/app-launcher";
import { MobileNav, Sidebar } from "@/components/navigation";
import { NotificationMenu } from "@/components/notification-menu";
import { ProgramOnboarding } from "@/components/program-onboarding";
import { ThemeModeToggle } from "@/components/theme-mode-toggle";
import { PageSkeleton } from "@/components/ui/skeleton";
import { UserMenu } from "@/components/user-menu";
import { useProgramView } from "@/hooks/use-program-view";

export function RootLayout() {
  const location = useLocation();
  const { viewer } = useProgramView();
  const isKiosk = viewer?.profile.role === "kiosk";
  const isKioskPath = location.pathname.startsWith("/shop");
  const isSuiteLanding = location.pathname === "/";

  if (isKiosk && !isKioskPath) {
    return <Navigate to="/shop/display" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="flex min-h-screen">
        <ProgramOnboarding />
        {!isSuiteLanding && <Sidebar />}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-40 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/85">
            <div className="flex h-14 items-center justify-between gap-3 px-3 sm:px-6">
              {isSuiteLanding ? (
                <Link
                  to="/"
                  className="rounded-md px-1 text-sm font-semibold text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  Dolphin Apps
                </Link>
              ) : (
                <MobileNav />
              )}
              <div className="ml-auto flex items-center gap-1">
                <ThemeModeToggle />
                <AppLauncher labelled />
                <NotificationMenu />
                <UserMenu />
              </div>
            </div>
          </header>
          <main className={isSuiteLanding ? "flex-1 p-4 sm:p-8" : "flex-1 p-4 sm:p-6 lg:p-8"}>
            <Suspense fallback={<PageSkeleton />}>
              <Outlet />
            </Suspense>
          </main>
        </div>
      </div>
    </div>
  );
}

