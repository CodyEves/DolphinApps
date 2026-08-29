import { useConvexAuth } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import {
  ArrowRight,
  Clock,
  GraduationCap,
  Package,
  Settings,
  ShieldCheck,
} from "lucide-react";
import { Link } from "react-router";

import { Button } from "@/components/ui/button";
import { useProgramView } from "@/hooks/use-program-view";
import { canOpenManagement } from "@/lib/role-access";
import { useEffectiveRole } from "@/providers/role-preview-provider";
import { api } from "@convex/_generated/api";

const accentClasses = ["text-brand-blue", "text-brand-aqua", "text-brand-orange", "text-primary"];

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
    },
    {
      title: activeProgramMeta.partsTitle,
      description: "Part numbers, build status, BOMs, manufacturing queues, and purchasing requests.",
      href: "/parts",
      icon: Package,
      label: "Build system",
    },
    {
      title: "Shop Attendance",
      description: "Shop sessions, codes, live roster, attendance correction, and hour reports.",
      href: "/shop",
      icon: Clock,
      label: "Hours",
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
    <div className="mx-auto max-w-4xl">
      <section className="border-b border-border/70 pb-10">
        <p className="font-heading text-xs font-semibold uppercase tracking-[0.25em] text-brand-blue">
          Robot Dolphins · Team Operations
        </p>
        <h1 className="mt-3 max-w-2xl font-heading text-5xl font-semibold tracking-tight text-brand-navy dark:text-foreground sm:text-6xl">
          Dolphin Apps
        </h1>
        <p className="mt-4 max-w-lg text-base leading-7 text-muted-foreground sm:text-lg">
          One workspace for student learning, shop readiness, robot build operations,
          and mentor oversight.
        </p>

        <div className="mt-7 flex flex-wrap items-center gap-x-8 gap-y-4">
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
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <div className="whitespace-nowrap">
              <span className="font-heading text-2xl font-semibold text-foreground">
                {apps.length}
              </span>
              <span className="ml-1.5 text-sm text-muted-foreground">apps available</span>
            </div>
            <div className="hidden h-8 w-px bg-border sm:block" />
            <p className="text-sm text-muted-foreground">
              {isAuthenticated ? (
                <>
                  Signed in ·{" "}
                  <span className="font-medium text-foreground">{effectiveRole} access</span>
                </>
              ) : (
                "Sign in to load your workspace"
              )}
            </p>
          </div>
        </div>
      </section>

      <section className="divide-y divide-border/70">
        {apps.map((app, index) => {
          const Icon = app.icon;
          const accent = accentClasses[index % accentClasses.length];

          return (
            <Link
              key={app.title}
              to={app.href}
              className="group flex items-center gap-5 py-6 outline-none transition-colors first:pt-8 hover:bg-accent/50 focus-visible:bg-accent/50 sm:gap-7 sm:px-2"
            >
              <span className="font-heading w-9 shrink-0 text-2xl font-semibold text-muted-foreground/30 sm:w-11 sm:text-3xl">
                {String(index + 1).padStart(2, "0")}
              </span>
              <Icon className={`size-6 shrink-0 sm:size-7 ${accent}`} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h2 className="font-heading text-lg font-semibold tracking-tight text-foreground sm:text-xl">
                    {app.title}
                  </h2>
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {app.label}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground sm:text-base">{app.description}</p>
              </div>
              <ArrowRight className="size-5 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-1 group-hover:text-primary" />
            </Link>
          );
        })}
      </section>
    </div>
  );
}
