import { Suspense } from "react";
import { Link, Navigate, Outlet, useLocation } from "react-router";

import { AppLauncher } from "@/components/app-launcher";
import { PageTabs } from "@/components/navigation";
import { NotificationMenu } from "@/components/notification-menu";
import { ProgramOnboarding } from "@/components/program-onboarding";
import { ThemeModeToggle } from "@/components/theme-mode-toggle";
import { PageSkeleton } from "@/components/ui/skeleton";
import { UserMenu } from "@/components/user-menu";
import { useProgramView } from "@/hooks/use-program-view";

/**
 * Buttons inside the blue app bar read white. These selectors outrank a
 * button's own variant colors so the shared menus need no special props.
 */
const onBarButtons =
  "[&_[data-slot=button]]:border-white/25 [&_[data-slot=button]]:bg-transparent [&_[data-slot=button]]:text-white [&_[data-slot=button]]:shadow-none [&_[data-slot=button]:hover]:bg-white/12 [&_[data-slot=button]:hover]:text-white [&_[data-slot=button]:focus-visible]:ring-white/50 [&_[data-slot=button][data-state=open]]:bg-white/15";

export function RootLayout() {
  const location = useLocation();
  const { viewer } = useProgramView();
  const isKiosk = viewer?.profile.role === "kiosk";
  const isKioskPath = location.pathname.startsWith("/shop");
  const isSuiteLanding = location.pathname === "/";
  /** Pages that stand outside any one app: no app switcher, no page tabs. */
  const isChromeless =
    isSuiteLanding || location.pathname.startsWith("/auth") || location.pathname.startsWith("/profile");

  if (isKiosk && !isKioskPath) {
    return <Navigate to="/shop/display" replace />;
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <ProgramOnboarding />
      <header className="sticky top-0 z-40">
        <div className="bg-app-bar text-app-bar-foreground">
          <div className={`mx-auto flex h-16 max-w-[75rem] items-center gap-1 px-3 sm:gap-2 sm:px-5 ${onBarButtons}`}>
            <Link
              to="/"
              className="flex shrink-0 items-center gap-2.5 rounded-[10px] p-1 pr-2 outline-none transition-colors hover:bg-white/10 focus-visible:ring-[3px] focus-visible:ring-white/50"
              aria-label="Dolphin Apps home"
            >
              <img
                src="/robot-dolphins-error.png"
                alt=""
                width={36}
                height={36}
                className="size-9 rounded-[9px] shadow-[0_0_0_1px_rgb(255_255_255/0.25)]"
              />
              <span className={isChromeless ? "font-heading text-[15px] font-semibold" : "hidden font-heading text-[15px] font-semibold md:inline"}>
                Dolphin Apps
              </span>
            </Link>
            {!isChromeless && (
              <>
                <span className="hidden text-lg text-white/30 md:inline" aria-hidden>
                  /
                </span>
                <AppLauncher labelled />
              </>
            )}
            <div className="ml-auto flex shrink-0 items-center gap-0.5">
              <ThemeModeToggle />
              <NotificationMenu />
              <UserMenu />
            </div>
          </div>
        </div>
        {!isChromeless && <PageTabs />}
      </header>
      <main className={isSuiteLanding ? "flex-1" : "flex-1 px-4 py-6 sm:px-6 sm:py-10"}>
        <Suspense fallback={<div className="px-4 py-10 sm:px-6"><PageSkeleton /></div>}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}
