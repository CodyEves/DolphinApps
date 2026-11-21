import { useConvexAuth } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import {
  ArrowRight,
  BatteryCharging,
  CalendarDays,
  Clock,
  GraduationCap,
  LogIn,
  Package,
  Settings,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";

import { TeamPlate, TeamSwitcher } from "@/components/team-plate";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useProgramView } from "@/hooks/use-program-view";
import { programMeta } from "@/lib/programs";
import { canOpenManagement } from "@/lib/role-access";
import { cn } from "@/lib/utils";
import { useEffectiveRole } from "@/providers/role-preview-provider";
import { api } from "@convex/_generated/api";

type AppTile = {
  title: string;
  href: string;
  icon: LucideIcon;
  description: string;
};

function greeting(now = new Date()) {
  const hour = now.getHours();

  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";

  return "Good evening";
}

function firstName(profile: { firstName?: string; displayName?: string } | null | undefined) {
  const name = profile?.firstName?.trim() || profile?.displayName?.trim().split(/\s+/)[0];

  return name || null;
}

const timeFormat = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
const dateFormat = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" });

export function HomePage() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const {
    viewer,
    profile,
    activeProgramMeta,
    selectedProgram,
    availablePrograms,
    canSwitchPrograms,
    selectProgram,
  } = useProgramView();
  const effectiveRole = useEffectiveRole(viewer?.profile.role);
  const hasManagementAccess = canOpenManagement(effectiveRole);
  const isActive = profile?.status === "active";

  const learning = useQuery(api.learning.myLearning, isAuthenticated ? {} : "skip");
  const shop = useQuery(api.shopAttendance.currentShopSession, isAuthenticated ? {} : "skip");
  const myAttendance = useQuery(
    api.shopAttendance.myCurrentAttendance,
    isAuthenticated && isActive && effectiveRole !== "kiosk" ? {} : "skip",
  );
  const feed = useQuery(api.notifications.listMine, isAuthenticated ? {} : "skip");
  const batteries = useQuery(api.batteries.list, { program: selectedProgram });

  const apps: AppTile[] = [
    {
      title: activeProgramMeta.trainingTitle,
      href: "/dashboard",
      icon: GraduationCap,
      description: "Skills and badges",
    },
    { title: "Shop Attendance", href: "/shop", icon: Clock, description: "Sign in, see hours" },
    { title: "Shop Tools", href: "/tools", icon: Wrench, description: "SOPs and sign-offs" },
    { title: activeProgramMeta.partsTitle, href: "/parts", icon: Package, description: "BOMs and orders" },
    { title: "Batteries", href: "/batteries", icon: BatteryCharging, description: "Charge and health" },
    ...(hasManagementAccess
      ? [
          { title: "Interviews", href: "/interviews", icon: CalendarDays, description: "Tryout schedule" },
          { title: "Management", href: "/management", icon: Settings, description: "People and reviews" },
        ]
      : []),
  ];

  const name = firstName(profile);
  const signedOut = !isLoading && !isAuthenticated;
  const teamNumber = activeProgramMeta.teamNumber;

  return (
    <div className="mx-auto max-w-5xl space-y-10 pb-8 sm:space-y-12">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-6">
        {canSwitchPrograms && availablePrograms.length > 1 ? (
          <TeamSwitcher
            size="lg"
            options={availablePrograms.map((program) => ({ value: program, teamNumber: programMeta[program].teamNumber }))}
            value={selectedProgram}
            onChange={selectProgram}
          />
        ) : signedOut ? (
          <div className="flex items-center gap-2" aria-hidden>
            <TeamPlate number="5199" size="lg" />
            <TeamPlate number="9271" size="lg" />
          </div>
        ) : (
          <TeamPlate number={teamNumber} size="lg" className="self-start sm:self-auto" />
        )}

        <div className="min-w-0 space-y-1">
          <h1 className="text-[2rem] leading-[1.1] font-bold sm:text-[2.5rem]">
            {signedOut ? "Robot Dolphins team apps" : name ? `${greeting()}, ${name}` : greeting()}
          </h1>
          <p className="text-base text-muted-foreground">
            {signedOut
              ? "Skills, shop hours, parts, and batteries for teams 5199 and 9271."
              : `${dateFormat.format(new Date())}`}
          </p>
        </div>
      </header>

      {signedOut && (
        <section className="flex flex-col gap-5 rounded-xl border bg-card p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div className="space-y-1">
            <h2 className="text-2xl font-bold">Sign in to see your next skill</h2>
            <p className="text-muted-foreground">Your progress, shop hours, and sign-offs load after you sign in.</p>
          </div>
          <Button asChild variant="cta" size="lg" className="self-start sm:self-auto">
            <Link to="/auth">
              <LogIn />
              Sign in
            </Link>
          </Button>
        </section>
      )}

      <section aria-labelledby="now-heading" className="space-y-3">
        <h2 id="now-heading" className="text-lg font-semibold">
          Right now
        </h2>
        <div
          className={cn(
            "grid overflow-hidden rounded-xl border bg-card",
            signedOut ? "grid-cols-1" : "divide-y md:grid-cols-3 md:divide-x md:divide-y-0",
          )}
        >
          {!signedOut && (
            <ShopStatus
              shop={shop}
              myAttendance={myAttendance}
              canCheckIn={effectiveRole !== "kiosk" && isActive}
            />
          )}
          <BatteryStatus batteries={batteries} teamNumber={teamNumber} />
          {!signedOut && <WaitingOnYou feed={feed} />}
        </div>
      </section>


      {!signedOut && <LearningFeature learning={learning} />}

      <section aria-labelledby="apps-heading" className="space-y-4">
        <h2 id="apps-heading" className="text-lg font-semibold">
          Apps
        </h2>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {apps.map((app) => (
            <li key={app.href}>
              <Link
                to={app.href}
                className="group flex h-full flex-col gap-3 rounded-xl p-3 outline-none transition-colors hover:bg-card focus-visible:bg-card focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:flex-row sm:items-center sm:p-4"
              >
                <span className="grid size-11 shrink-0 place-items-center rounded-[10px] bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground dark:bg-primary/15">
                  <app.icon className="size-5" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block font-semibold leading-5">{app.title}</span>
                  <span className="mt-0.5 block text-sm leading-5 text-muted-foreground">{app.description}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/* Right now: three short status readouts in one panel                       */
/* ------------------------------------------------------------------------ */

function StatusCell({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: { label: string; href: string };
}) {
  return (
    <div className="flex min-h-36 flex-col gap-3 p-5">
      <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
      <div className="flex-1 space-y-1">{children}</div>
      {action && (
        <Link
          to={action.href}
          className="inline-flex items-center gap-1.5 self-start rounded-sm text-sm font-semibold text-primary outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          {action.label}
          <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      )}
    </div>
  );
}

function CellSkeleton() {
  return (
    <div className="space-y-2" aria-hidden>
      <Skeleton className="h-6 w-32" />
      <Skeleton className="h-4 w-44" />
    </div>
  );
}

type ShopData = ReturnType<typeof useQuery<typeof api.shopAttendance.currentShopSession>>;
type MyAttendanceData = ReturnType<typeof useQuery<typeof api.shopAttendance.myCurrentAttendance>>;

function ShopStatus({
  shop,
  myAttendance,
  canCheckIn,
}: {
  shop: ShopData;
  myAttendance: MyAttendanceData;
  canCheckIn: boolean;
}) {
  if (shop === undefined) {
    return (
      <StatusCell title="Shop">
        <CellSkeleton />
      </StatusCell>
    );
  }

  const isOpen = Boolean(shop.session);
  const signedIn = Boolean(myAttendance);

  const action = !canCheckIn
    ? { label: "Open attendance", href: "/shop" }
    : !isOpen
      ? { label: "See your hours", href: "/shop?tab=checkin" }
      : signedIn
        ? { label: "Sign out", href: "/shop?tab=checkin" }
        : { label: "Sign in to the shop", href: "/shop?tab=checkin" };

  return (
    <StatusCell title="Shop" action={action}>
      <p className="flex items-center gap-2 font-heading text-xl font-semibold [font-stretch:87.5%]">
        <span
          aria-hidden
          className={cn(
            "size-2.5 shrink-0 rounded-full",
            isOpen ? "bg-success shadow-[0_0_0_3px_color-mix(in_srgb,var(--success)_22%,transparent)]" : "bg-muted-foreground/50",
          )}
        />
        {isOpen ? "Open" : "Closed"}
      </p>
      <p className="text-sm text-muted-foreground">
        {!isOpen
          ? "No shop session is running."
          : signedIn && myAttendance
            ? `You signed in at ${timeFormat.format(myAttendance.signInAt)}. ${shop.openCount} here now.`
            : `${shop.openCount} ${shop.openCount === 1 ? "person is" : "people are"} signed in.`}
      </p>
    </StatusCell>
  );
}

type BatteryData = ReturnType<typeof useQuery<typeof api.batteries.list>>;

const cellStyles = {
  ready: "bg-success",
  in_robot: "bg-primary",
  needs_charge: "bg-warning/70",
  unknown: "bg-muted-foreground/30",
  retired: "bg-muted-foreground/30",
} as const;

function BatteryStatus({ batteries, teamNumber }: { batteries: BatteryData; teamNumber: string }) {
  const title = `Team ${teamNumber} batteries`;

  if (batteries === undefined) {
    return (
      <StatusCell title={title}>
        <CellSkeleton />
      </StatusCell>
    );
  }

  const active = batteries.filter((battery) => !battery.retired);

  if (active.length === 0) {
    return (
      <StatusCell title={title} action={{ label: "Set up batteries", href: "/batteries" }}>
        <p className="text-sm text-muted-foreground">No batteries are set up for this team yet.</p>
      </StatusCell>
    );
  }

  const ready = active.filter((battery) => battery.state === "ready").length;
  const inRobot = active.filter((battery) => battery.state === "in_robot").length;
  const needsCharge = active.filter((battery) => battery.state === "needs_charge").length;
  const noReading = active.filter((battery) => battery.state === "unknown").length;
  const detail = [
    inRobot > 0 ? `${inRobot} in the robot` : null,
    needsCharge > 0 ? `${needsCharge} ${needsCharge === 1 ? "needs" : "need"} a charge` : null,
    noReading > 0 ? `${noReading} ${noReading === 1 ? "has" : "have"} no Beak reading yet` : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <StatusCell title={title} action={{ label: "Open batteries", href: "/batteries" }}>
      <p className="font-heading text-xl font-semibold tabular-nums [font-stretch:87.5%]">
        {ready} of {active.length} charged
      </p>
      <ul className="flex h-7 items-end gap-1 pt-1" aria-label="Battery charge states">
        {active.slice(0, 24).map((battery, index) => (
          <li
            key={battery._id}
            title={`${battery.displayName}: ${battery.state.replace("_", " ")}`}
            className="relative h-6 w-2.5 overflow-hidden rounded-[3px] bg-muted"
          >
            <span
              className={cn("absolute inset-0 origin-bottom animate-cell", cellStyles[battery.state])}
              style={{ animationDelay: `${index * 35}ms` }}
            />
            <span className="sr-only">
              {battery.displayName}: {battery.state.replace("_", " ")}
            </span>
          </li>
        ))}
      </ul>
      {detail && <p className="text-sm text-muted-foreground">{detail}.</p>}
    </StatusCell>
  );
}

type FeedData = ReturnType<typeof useQuery<typeof api.notifications.listMine>>;

function WaitingOnYou({ feed }: { feed: FeedData }) {
  if (feed === undefined) {
    return (
      <StatusCell title="Waiting on you">
        <CellSkeleton />
      </StatusCell>
    );
  }

  const items = feed.notifications;

  if (items.length === 0) {
    return (
      <StatusCell title="Waiting on you">
        <p className="font-heading text-xl font-semibold [font-stretch:87.5%]">All caught up</p>
        <p className="text-sm text-muted-foreground">Reviews and feedback for you will show up here.</p>
      </StatusCell>
    );
  }

  return (
    <StatusCell
      title="Waiting on you"
      action={feed.canReview ? { label: "Open review queue", href: "/management/reviews" } : undefined}
    >
      <p className="font-heading text-xl font-semibold tabular-nums [font-stretch:87.5%]">
        {feed.unreadCount > 100 ? "100+" : feed.unreadCount} {feed.unreadCount === 1 ? "item" : "items"}
      </p>
      <ul className="space-y-0.5">
        {items.slice(0, 2).map((item) => (
          <li key={item.id} className="truncate text-sm">
            <Link to={item.href} className="rounded-sm text-muted-foreground outline-none hover:text-foreground hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50">
              {item.title}
            </Link>
          </li>
        ))}
      </ul>
    </StatusCell>
  );
}

/* ------------------------------------------------------------------------ */
/* Next skill                                                                */
/* ------------------------------------------------------------------------ */

type LearningData = ReturnType<typeof useQuery<typeof api.learning.myLearning>>;

function LearningFeature({ learning }: { learning: LearningData }) {
  if (learning === undefined) {
    return (
      <section className="space-y-5 rounded-xl border bg-card p-6 sm:p-8" aria-busy>
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-9 w-3/4" />
        <Skeleton className="h-2 w-full" />
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
    <section aria-labelledby="learning-heading" className="rounded-xl border bg-card">
      <div className="flex flex-col gap-6 p-6 sm:p-8 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 max-w-2xl space-y-2">
          <p className="text-sm font-medium text-muted-foreground">
            {next ? "Your next skill" : "Learning"}
            {focus ? ` in ${focus.title}` : ""}
          </p>
          <h2 id="learning-heading" className="text-2xl leading-tight font-bold sm:text-[1.75rem]">
            {next ? next.title : total === 0 ? "No skills are published yet" : "You've finished this path"}
          </h2>
          {next?.stage && <p className="text-sm text-muted-foreground">Part of {next.stage}</p>}
        </div>
        <Button asChild variant="cta" size="lg" className="self-start lg:self-auto">
          <Link to={next ? `/training/skills/${next._id}` : "/training"}>
            {next ? "Continue" : "Open Learning"}
            <ArrowRight />
          </Link>
        </Button>
      </div>

      {total > 0 && (
        <div className="flex items-center gap-4 border-t px-6 py-4 sm:px-8">
          <div
            className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={done}
            aria-label={`${done} of ${total} skills done`}
          >
            <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${percent}%` }} />
          </div>
          <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
            {done} of {total} done
          </span>
        </div>
      )}
    </section>
  );
}
