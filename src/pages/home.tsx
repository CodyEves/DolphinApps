import { useConvexAuth } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import {
  ArrowRight,
  Clock,
  GraduationCap,
  Grid3X3,
  Package,
  Settings,
  ShieldCheck,
} from "lucide-react";
import { Link } from "react-router";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useProgramView } from "@/hooks/use-program-view";
import { canOpenManagement } from "@/lib/role-access";
import { useEffectiveRole } from "@/providers/role-preview-provider";
import { api } from "@convex/_generated/api";

export function HomePage() {
  const { isAuthenticated } = useConvexAuth();
  const viewer = useQuery(api.profiles.viewer, isAuthenticated ? {} : "skip");
  const effectiveRole = useEffectiveRole(viewer?.profile.role);
  const hasManagementAccess = canOpenManagement(effectiveRole);
  const { activeProgramMeta } = useProgramView();
  const apps = [
    {
      title: activeProgramMeta.trainingTitle,
      description: "Student learning paths, safety training, assignments, badges, and mentor reviews.",
      href: "/dashboard",
      icon: GraduationCap,
      label: "Learning",
      enabled: true,
    },
    {
      title: activeProgramMeta.partsTitle,
      description: "Part numbers, build status, BOMs, manufacturing queues, and purchasing requests.",
      href: "/parts",
      icon: Package,
      label: "Build system",
      enabled: true,
    },
    {
      title: "Shop Attendance",
      description: "Shop sessions, codes, live roster, attendance correction, and hour reports.",
      href: "/shop",
      icon: Clock,
      label: "Hours",
      enabled: true,
    },
    {
      title: "Management",
      description: "Team progress, reviews, people, badges, paperwork, and admin tools.",
      href: "/management",
      icon: Settings,
      label: "Management",
      managementOnly: true,
    },
  ].filter((app) => !app.managementOnly || hasManagementAccess);

  return (
    <div className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-7xl flex-col justify-center space-y-8">
      <section className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end">
        <div className="space-y-5">
          <Badge variant="secondary" className="w-fit">
            <Grid3X3 className="size-3.5" />
            Team operations suite
          </Badge>
          <div className="space-y-4">
            <h1 className="max-w-4xl text-4xl font-semibold tracking-normal text-brand-navy dark:text-foreground sm:text-5xl">
              Dolphin Apps
            </h1>
            <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
              One workspace for student learning, shop readiness, robot build operations,
              and mentor oversight.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link to="/dashboard">
                <GraduationCap className="size-4" />
                Open learning dashboard
              </Link>
            </Button>
            {hasManagementAccess && (
              <Button asChild variant="outline">
                <Link to="/management/team">
                  <ShieldCheck className="size-4" />
                  Review team progress
                </Link>
              </Button>
            )}
          </div>
        </div>
        <div className="rounded-md border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Signed-in view</p>
              <p className="text-sm text-muted-foreground">
                {isAuthenticated
                  ? `${effectiveRole} access`
                  : "Sign in to load your team workspace"}
              </p>
            </div>
            <Badge variant={isAuthenticated ? "default" : "outline"}>
              {isAuthenticated ? "Ready" : "Guest"}
            </Badge>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-md border bg-muted/35 p-3">
              <p className="font-semibold">{apps.length}</p>
              <p className="text-xs text-muted-foreground">Apps available</p>
            </div>
            <div className="rounded-md border bg-muted/35 p-3">
              <p className="font-semibold">{hasManagementAccess ? "On" : "Off"}</p>
              <p className="text-xs text-muted-foreground">Management tools</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {apps.map((app) => {
          const Icon = app.icon;

          return (
            <Link
              key={app.title}
              to={app.href}
              className="rounded-lg focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <Card className="h-full transition-colors hover:border-ring/40 hover:bg-accent">
              <CardHeader>
                <div className="mb-2 flex size-11 items-center justify-center rounded-md bg-primary text-primary-foreground">
                  <Icon className="size-5" />
                </div>
                <Badge variant="outline" className="w-fit">{app.label}</Badge>
                <CardTitle>{app.title}</CardTitle>
                <CardDescription>{app.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <span className="inline-flex items-center gap-2 text-sm font-medium text-primary">
                  Open app
                  <ArrowRight className="size-4" />
                </span>
              </CardContent>
            </Card>
            </Link>
          );
        })}
      </section>
    </div>
  );
}
