import { Suspense } from "react";
import { useConvexAuth } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import { Outlet, useLocation } from "react-router";

import { EnsureProfile } from "@/components/ensure-profile";
import { MobileNav, Sidebar } from "@/components/navigation";
import { ProgramOnboarding } from "@/components/program-onboarding";
import { ThemeModeToggle } from "@/components/theme-mode-toggle";
import { UserMenu } from "@/components/user-menu";
import { programForProfile, programMeta, type Program } from "@/lib/programs";
import { api } from "@convex/_generated/api";

function currentAppCopy(pathname: string, program: Program = "frc_5199") {
  const meta = programMeta[program];

  if (pathname.startsWith("/parts")) {
    return {
      title: meta.partsTitle,
      description: meta.partsDescription,
    };
  }

  return {
    title: meta.trainingTitle,
    description: meta.trainingDescription,
  };
}

export function RootLayout() {
  const location = useLocation();
  const { isAuthenticated } = useConvexAuth();
  const viewer = useQuery(api.profiles.viewer, isAuthenticated ? {} : "skip");
  const appCopy = currentAppCopy(
    location.pathname,
    programForProfile(viewer?.profile),
  );
  return (
    <div className="min-h-screen bg-background">
      <EnsureProfile />
      <div className="flex min-h-screen">
        <ProgramOnboarding />
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
            <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6">
              <MobileNav />
              <div className="hidden min-w-0 lg:block">
                <p className="text-sm font-semibold">{appCopy.title}</p>
                <p className="text-xs text-muted-foreground">
                  {appCopy.description}
                </p>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <ThemeModeToggle />
                <UserMenu />
              </div>
            </div>
          </header>
          <main className="flex-1 p-4 sm:p-6">
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

