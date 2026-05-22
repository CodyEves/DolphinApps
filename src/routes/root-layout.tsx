import { Outlet } from "react-router";

import { EnsureProfile } from "@/components/ensure-profile";
import { MobileNav, Sidebar } from "@/components/navigation";
import { ThemeModeToggle } from "@/components/theme-mode-toggle";
import { UserMenu } from "@/components/user-menu";

export function RootLayout() {
  return (
    <div className="min-h-screen bg-background">
      <EnsureProfile />
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur">
            <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6">
              <MobileNav />
              <div className="hidden min-w-0 lg:block">
                <p className="text-sm font-semibold">Robot Dolphins From Outer Space</p>
                <p className="text-xs text-muted-foreground">
                  Team 5199 training, safety, and sign-offs
                </p>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <ThemeModeToggle />
                <UserMenu />
              </div>
            </div>
          </header>
          <main className="flex-1 p-4 sm:p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
