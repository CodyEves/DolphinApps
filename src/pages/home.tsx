import { useConvexAuth } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import {
  ArrowRight,
  BatteryCharging,
  Clock,
  GraduationCap,
  LogIn,
  Package,
  Settings,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link } from "react-router";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useProgramView } from "@/hooks/use-program-view";
import { canOpenManagement } from "@/lib/role-access";
import { cn } from "@/lib/utils";
import { useEffectiveRole } from "@/providers/role-preview-provider";
import { api } from "@convex/_generated/api";

type AppRow = {
  title: string;
  href: string;
  icon: LucideIcon;
  /** What the app shows right now, from live data. */
  status: string | null;
  description: string;
};

export function HomePage() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const viewer = useQuery(api.profiles.viewer, isAuthenticated ? {} : "skip");
  const effectiveRole = useEffectiveRole(viewer?.profile.role);
  const hasManagementAccess = canOpenManagement(effectiveRole);
  const { activeProgramMeta, selectedProgram } = useProgramView();
  const learning = useQuery(api.learning.myLearning, isAuthenticated ? {} : "skip");
  const shop = useQuery(api.shopAttendance.currentShopSession, isAuthenticated ? {} : "skip");
  const batteries = useQuery(api.batteries.list, { program: selectedProgram });

  const shopStatus =
    shop === undefined
      ? null
      : shop.session
        ? `Shop is open · ${shop.openCount} signed in`
        : "No shop session running";
  const activeBatteries = batteries?.filter((battery) => !battery.retired) ?? [];
  const readyBatteries = activeBatteries.filter((battery) => battery.state === "ready").length;
  const batteryStatus =
    batteries === undefined
      ? null
      : activeBatteries.length === 0
        ? "No batteries set up"
        : `${readyBatteries} of ${activeBatteries.length} charged and ready`;

  const apps: AppRow[] = [
    {
      title: "Shop Attendance",
      href: "/shop",
      icon: Clock,
      status: isAuthenticated ? shopStatus : null,
      description: "Sign in and out of the shop, and see your hours.",
    },
    {
      title: activeProgramMeta.partsTitle,
      href: "/parts",
      icon: Package,
      status: null,
      description: "Part numbers, BOMs, manufacturing, and orders.",
    },
    {
      title: "Shop Tools",
      href: "/tools",
      icon: Wrench,
      status: null,
      description: "SOPs, safety tests, and tool sign-offs.",
    },
    {
      title: "Batteries",
      href: "/batteries",
      icon: BatteryCharging,
      status: batteryStatus,
      description: "Which battery ran which match, and its health.",
    },
    ...(hasManagementAccess
      ? [
          {
            title: "Management",
            href: "/management",
            icon: Settings,
            status: null,
            description: "People, reviews, badges, and team progress.",
          },
        ]
      : []),
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-12 py-4">
      <header className="max-w-2xl space-y-3">
        <h1 className="text-4xl leading-[1.05] font-bold sm:text-5xl">
          Train, build, and track the Robot Dolphins
        </h1>
        <p className="text-lg leading-8 text-muted-foreground">
          Skills, shop hours, robot parts, and batteries for FRC 5199 and 9271.
        </p>
      </header>

      {!isLoading && !isAuthenticated ? (
        <section className="flex flex-col items-start gap-4 rounded-xl border bg-card p-6 sm:p-8">
          <div className="space-y-1">
            <h2 className="text-2xl font-bold">Sign in to see your next skill</h2>
            <p className="text-muted-foreground">Your progress, hours, and sign-offs load after you sign in.</p>
          </div>
          <Button asChild variant="cta" size="lg">
            <Link to="/auth">
              <LogIn />
              Sign in
            </Link>
          </Button>
        </section>
      ) : (
        <LearningFeature learning={learning} title={activeProgramMeta.trainingTitle} />
      )}

      <section aria-labelledby="apps-heading" className="space-y-3">
        <h2 id="apps-heading" className="text-lg font-semibold">
          Other apps
        </h2>
        <ul className="grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-2">
          {apps.map((app) => (
            <li key={app.href} className="bg-card">
              <Link
                to={app.href}
                className="group flex h-full items-start gap-4 p-5 outline-none transition-colors hover:bg-accent focus-visible:bg-accent"
              >
                <app.icon className="mt-0.5 size-5 shrink-0 text-muted-foreground group-hover:text-primary" aria-hidden />
                <span className="min-w-0 flex-1 space-y-1">
                  <span className="block font-semibold">{app.title}</span>
                  <span className="block text-sm text-muted-foreground">{app.description}</span>
                  {app.status && <span className="block pt-1 text-sm font-medium text-foreground">{app.status}</span>}
                </span>
                <ArrowRight className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

type LearningData = ReturnType<typeof useQuery<typeof api.learning.myLearning>>;

/** The main feature: the signed-in student's real next skill and path progress. */
function LearningFeature({ learning, title }: { learning: LearningData; title: string }) {
  if (learning === undefined) {
    return (
      <section className="space-y-5 rounded-xl border bg-card p-6 sm:p-8" aria-busy>
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-9 w-3/4" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-11 w-48" />
      </section>
    );
  }

  const paths = learning?.paths ?? [];
  const focus = paths.find((path) => path._id === learning?.focusPathId) ?? paths[0];
  const next =
    focus?.skills.find((skill) => skill.status === "needs_work") ??
    focus?.skills.find((skill) => skill.status === null);
  const done = focus?.skills.filter((skill) => skill.status === "completed").length ?? 0;
  const total = focus?.skills.length ?? 0;
  const percent = total ? Math.round((done / total) * 100) : 0;

  return (
    <section aria-labelledby="learning-heading" className="rounded-xl border bg-card p-6 sm:p-8">
      <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 max-w-2xl space-y-3">
          <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <GraduationCap className="size-4" aria-hidden />
            {title}
            {focus && <span aria-hidden>·</span>}
            {focus?.title}
          </p>
          <h2 id="learning-heading" className="text-2xl leading-tight font-bold sm:text-3xl">
            {next
              ? next.title
              : total === 0
                ? "No skills are published yet"
                : "You've finished this path"}
          </h2>
          {next && <p className="text-muted-foreground">Next up in {next.stage}.</p>}
        </div>
        <Button asChild variant="cta" size="lg" className="self-start lg:self-auto">
          <Link to={next ? `/training/skills/${next._id}` : "/training"}>
            {next ? "Continue" : "Open Learning"}
            <ArrowRight />
          </Link>
        </Button>
      </div>

      {total > 0 && (
        <div className="mt-8 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="font-medium">
              {done} of {total} skills done
            </span>
            <span className="text-muted-foreground tabular-nums">{percent}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className={cn("h-full rounded-full bg-primary transition-[width] duration-500")} style={{ width: `${percent}%` }} />
          </div>
        </div>
      )}
    </section>
  );
}
