import { Suspense } from "react";
import { Navigate, Outlet, useLocation } from "react-router";

import { AppLauncher } from "@/components/app-launcher";
import { MobileNav, Sidebar } from "@/components/navigation";
import { NotificationMenu } from "@/components/notification-menu";
import { ProgramOnboarding } from "@/components/program-onboarding";
import { ThemeModeToggle } from "@/components/theme-mode-toggle";
import { UserMenu } from "@/components/user-menu";
import { useProgramView } from "@/hooks/use-program-view";
import { programMeta, type Program } from "@/lib/programs";

function currentAppCopy(pathname: string, program: Program = "frc_5199") {
  const meta = programMeta[program];

  if (pathname === "/") {
    return {
      title: "Apps",
      description: "Choose an app.",
    };
  }

  if (pathname.startsWith("/management") || pathname.startsWith("/admin")) {
    return {
      title: "Management",
      description: "Reviews, badges, rosters, and team operations.",
    };
  }

  if (pathname.startsWith("/parts")) {
    return {
      title: meta.partsTitle,
      description: meta.partsDescription,
    };
  }

  if (pathname.startsWith("/shop")) {
    return {
      title: "Shop Attendance",
      description: "Slack check-ins, shop hours, and review queue.",
    };
  }

  return {
    title: meta.trainingTitle,
    description: meta.trainingDescription,
  };
}

export function RootLayout() {
  const location = useLocation();
  const { selectedProgram, viewer } = useProgramView();
  const isKiosk = viewer?.profile.role === "kiosk";
  const isKioskPath = location.pathname.startsWith("/shop");
  const appCopy = currentAppCopy(location.pathname, selectedProgram);
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
            <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6">
              {!isSuiteLanding && <MobileNav />}
              <div className={isSuiteLanding ? "min-w-0" : "hidden min-w-0 lg:block"}>
                <p className="text-sm font-semibold">{appCopy.title}</p>
                <p className="text-xs text-muted-foreground">
                  {appCopy.description}
                </p>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <ThemeModeToggle />
                <AppLauncher collapsed />
                <NotificationMenu />
                <UserMenu />
              </div>
            </div>
          </header>
          <main className={isSuiteLanding ? "flex-1 p-4 sm:p-8" : "flex-1 p-4 sm:p-6 lg:p-8"}>
            <Suspense
              fallback={
                <div className="rounded-md border bg-card p-6 text-sm text-muted-foreground">
                  Loading...
                </div>
              }
            >
              <Outlet />
            </Suspense>
          </main>
        </div>
      </div>
    </div>
  );
}

