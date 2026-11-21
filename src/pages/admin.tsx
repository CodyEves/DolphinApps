import { useConvexAuth } from "@convex-dev/auth/react";
import { Authenticated, Unauthenticated, useQuery } from "convex/react";
import {
  ArrowRight,
  Award,
  ClipboardCheck,
  Database,
  FileCheck,
  ShieldCheck,
  Users,
  BookOpen,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { Link } from "react-router";

import { PageHeading } from "@/components/page-heading";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  canManageBadges,
  canOpenManagement,
  canEditLearning,
  canReviewLearning,
  isAdminRole,
} from "@/lib/role-access";
import { cn } from "@/lib/utils";
import { useEffectiveRole } from "@/providers/role-preview-provider";
import { api } from "@convex/_generated/api";


type Tool = {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  visible: boolean;
  group: "students" | "content" | "admin";
};

const groupLabels: Record<Tool["group"], string> = {
  students: "Students",
  content: "Learning content",
  admin: "Accounts and setup",
};

function WaitingCount({
  label,
  count,
  href,
  action,
}: {
  label: string;
  count: number | undefined;
  href: string;
  action: string;
}) {
  return (
    <Link
      to={href}
      className="group flex flex-col gap-1 p-5 outline-none transition-colors hover:bg-accent focus-visible:bg-accent"
    >
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      {count === undefined ? (
        <Skeleton className="my-1 h-8 w-10" />
      ) : (
        <span
          className={cn(
            "font-heading text-[2rem] leading-10 font-bold tabular-nums [font-stretch:87.5%]",
            count === 0 && "text-muted-foreground",
          )}
        >
          {count}
        </span>
      )}
      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary group-hover:underline">
        {count === 0 ? "Nothing waiting" : action}
        {count !== 0 && <ArrowRight className="size-3.5" aria-hidden />}
      </span>
    </Link>
  );
}

export function AdminPage() {
  const { isAuthenticated } = useConvexAuth();
  const viewer = useQuery(api.profiles.viewer, isAuthenticated ? {} : "skip");
  const effectiveRole = useEffectiveRole(viewer?.profile.role);
  const isActive = viewer?.profile.status === "active";
  const isAdmin = isAdminRole(effectiveRole);
  const hasManagementAccess = canOpenManagement(effectiveRole);
  const canReview = canReviewLearning(effectiveRole) && isActive;
  const canManageBadgeRecords = canManageBadges(effectiveRole);
  const reviewQueue = useQuery(api.adminLms.listReviewQueue, isAuthenticated && canReview ? {} : "skip");
  const signoffQueue = useQuery(api.learning.signoffQueue, isAuthenticated && canReview ? {} : "skip");
  const attendanceQueue = useQuery(api.shopAttendance.listReviewQueue, isAuthenticated && canReview ? {} : "skip");

  const tools: Tool[] = [
    {
      title: "Team progress",
      description: "Where every student is in each learning path.",
      href: "/training/team",
      icon: ShieldCheck,
      visible: true,
      group: "students" as const,
    },
    {
      title: "Reviews",
      description: "Uploaded lesson files and hands-on tool checks.",
      href: "/management/reviews",
      icon: ClipboardCheck,
      visible: canReview,
      group: "students" as const,
    },
    {
      title: "Paperwork",
      description: "Signed forms, consent records, and deadlines.",
      href: "/management/paperwork",
      icon: FileCheck,
      visible: true,
      group: "students" as const,
    },
    {
      title: "Learning skills",
      description: "Paths, skills, resource links, and quizzes.",
      href: "/training/manage",
      icon: BookOpen,
      visible: canEditLearning(effectiveRole),
      group: "content" as const,
    },
    {
      title: "Badges",
      description: "Badge rules, manual awards, and award records.",
      href: "/management/badges",
      icon: Award,
      visible: canManageBadgeRecords,
      group: "content" as const,
    },
    {
      title: "People",
      description: "Accounts, roles, graduation years, and status.",
      href: "/management/people",
      icon: Users,
      visible: isAdmin,
      group: "admin" as const,
    },
    {
      title: "Progress resets",
      description: "Clear old lesson progress, quiz attempts, or sign-offs.",
      href: "/management/lms",
      icon: Database,
      visible: isAdmin,
      group: "admin" as const,
    },
    {
      title: "Parts Admin",
      description: "Build seasons, subsystems, and catalog options.",
      href: "/management/parts",
      icon: Settings,
      visible: isAdmin,
      group: "admin" as const,
    },
  ].filter((tool) => tool.visible);
  const groups = (Object.keys(groupLabels) as Tool["group"][])
    .map((group) => ({ group, items: tools.filter((tool) => tool.group === group) }))
    .filter((entry) => entry.items.length > 0);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeading
        title="Team management"
        description="What's waiting on a mentor, and every tool for running the team."
      />

      <Unauthenticated>
        <Card>
          <CardHeader>
            <CardTitle>Sign in required</CardTitle>
            <CardDescription>
              Sign in with an admin or mentor account to use these tools.
            </CardDescription>
          </CardHeader>
        </Card>
      </Unauthenticated>

      <Authenticated>
        {!hasManagementAccess ? (
          <Card>
            <CardHeader>
              <CardTitle>Management tools are for mentors</CardTitle>
              <CardDescription>
                Sign in with an admin or mentor account to use them.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="space-y-10">
            {canReview && (
              <section aria-labelledby="waiting-heading" className="space-y-3">
                <h2 id="waiting-heading" className="text-lg font-semibold">
                  Waiting on you
                </h2>
                <div className="grid divide-y overflow-hidden rounded-xl border bg-card sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                  <WaitingCount
                    label="Skill sign-offs"
                    count={signoffQueue?.length}
                    href="/training/sign-offs"
                    action="Sign students off"
                  />
                  <WaitingCount
                    label="Tool checks and uploads"
                    count={
                      reviewQueue === undefined
                        ? undefined
                        : reviewQueue.handsOnReviews.length + reviewQueue.lessonSubmissions.length
                    }
                    href="/management/reviews"
                    action="Open reviews"
                  />
                  <WaitingCount
                    label="Attendance to fix"
                    count={attendanceQueue?.length}
                    href="/shop/review"
                    action="Fix sign-outs"
                  />
                </div>
              </section>
            )}

            <div className="grid gap-8 lg:grid-cols-3">
              {groups.map(({ group, items }) => (
                <section key={group} aria-labelledby={`group-${group}`} className="space-y-3">
                  <h2 id={`group-${group}`} className="text-lg font-semibold">
                    {groupLabels[group]}
                  </h2>
                  <ul className="divide-y overflow-hidden rounded-xl border bg-card">
                    {items.map((tool) => {
                      const Icon = tool.icon;

                      return (
                        <li key={tool.href}>
                          <Link
                            to={tool.href}
                            className="group flex items-start gap-3 p-4 outline-none transition-colors hover:bg-accent focus-visible:bg-accent"
                          >
                            <span className="grid size-9 shrink-0 place-items-center rounded-[8px] bg-primary/10 text-primary dark:bg-primary/15">
                              <Icon className="size-[18px]" aria-hidden />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block font-semibold leading-5">{tool.title}</span>
                              <span className="mt-0.5 block text-sm leading-5 text-muted-foreground">{tool.description}</span>
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
          </div>
        )}
      </Authenticated>
    </div>
  );
}
