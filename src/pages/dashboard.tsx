import { useConvexAuth } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import { ArrowRight, Award, ClipboardCheck, GraduationCap, UserCheck, Wrench } from "lucide-react";
import { Link } from "react-router";

import { PageHeading } from "@/components/page-heading";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageSkeleton, Skeleton } from "@/components/ui/skeleton";
import { canReviewLearning } from "@/lib/role-access";
import { useEffectiveRole } from "@/providers/role-preview-provider";
import { api } from "@convex/_generated/api";

function StatLink({
  to,
  icon: Icon,
  label,
  value,
  detail,
}: {
  to: string;
  icon: typeof Award;
  label: string;
  value: string | number | undefined;
  detail: string;
}) {
  return (
    <Link
      to={to}
      className="group flex items-start gap-3 rounded-lg border bg-card p-4 transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground group-hover:text-primary" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block text-sm text-muted-foreground">{label}</span>
        {value === undefined ? (
          <Skeleton className="mt-1 h-7 w-12" />
        ) : (
          <span className="block font-heading text-2xl font-semibold tabular-nums [font-stretch:87.5%]">{value}</span>
        )}
        <span className="block text-xs text-muted-foreground">{detail}</span>
      </span>
    </Link>
  );
}

export function DashboardPage() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const viewer = useQuery(api.profiles.viewer, isAuthenticated ? {} : "skip");
  const learning = useQuery(api.learning.myLearning, isAuthenticated ? {} : "skip");
  const equipment = useQuery(api.equipment.listEquipment, isAuthenticated ? {} : "skip");
  const badges = useQuery(api.badges.listBadges, isAuthenticated ? {} : "skip");
  const badgeAwards = useQuery(
    api.badges.listMyBadgeAwards,
    isAuthenticated ? {} : "skip",
  );
  const role = useEffectiveRole(viewer?.profile.role);
  const canReview = canReviewLearning(role);
  const reviewQueue = useQuery(
    api.adminLms.listReviewQueue,
    isAuthenticated && canReview ? {} : "skip",
  );
  const signoffQueue = useQuery(
    api.learning.signoffQueue,
    isAuthenticated && canReview ? {} : "skip",
  );
  const earnedBadgeIds = new Set(badgeAwards?.map((award) => award.badgeId));
  const pathProgress =
    learning?.paths.map((path) => {
      const done = path.skills.filter((skill) => skill.status === "completed").length;
      const total = path.skills.length;

      return {
        id: path._id,
        title: path.title,
        done,
        total,
        percent: total > 0 ? Math.round((done / total) * 100) : 0,
        next:
          path.skills.find((skill) => skill.status === "needs_work") ??
          path.skills.find((skill) => skill.status === null),
      };
    }) ?? [];
  const focusPath =
    pathProgress.find((path) => path.id === learning?.focusPathId) ??
    pathProgress.find((path) => path.done > 0 && path.done < path.total) ??
    pathProgress[0];
  const nextSkill = focusPath?.next ?? pathProgress.find((path) => path.next)?.next;
  const nextSkillPath = focusPath?.next ? focusPath : pathProgress.find((path) => path.next);
  const earnedVisibleBadgeCount =
    badges?.filter((badge) => badge && earnedBadgeIds.has(badge._id)).length ?? 0;
  const equipmentApprovalSummary = equipment?.reduce(
    (summary, item) => {
      if (!item.instructorApprovalRequired) {
        return summary;
      }

      const mySignOff = item.signOffs.find(
        (signOff) => signOff.userId === viewer?.user._id,
      );

      if (mySignOff?.status === "approved") {
        return { ...summary, approved: summary.approved + 1 };
      }

      return { ...summary, pending: summary.pending + 1 };
    },
    { approved: 0, pending: 0 },
  );
  const isLoadingBadges = badges === undefined || badgeAwards === undefined;
  const lessonReviewCount = reviewQueue?.lessonSubmissions.length ?? 0;
  const handsOnReviewCount = reviewQueue?.handsOnReviews.length ?? 0;
  const signoffCount = signoffQueue?.length ?? 0;

  if (isLoading) {
    return <PageSkeleton rows={3} />;
  }

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Sign in to see your next skill</CardTitle>
            <CardDescription>Your learning progress, tool sign-offs, and badges load after you sign in.</CardDescription>
          </CardHeader>
          <div className="px-5">
            <Button asChild variant="cta">
              <Link to="/auth">Sign in</Link>
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <PageHeading
        title={nextSkill ? "Your next skill" : "Your learning"}
        description="Pick up where you left off, then check your tool sign-offs and badges."
      />

      <section aria-labelledby="next-skill" className="rounded-xl border bg-card p-6 sm:p-8">
        {learning === undefined ? (
          <div className="space-y-4" aria-busy>
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-2 w-full" />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="min-w-0 max-w-2xl space-y-2">
                <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <GraduationCap className="size-4" aria-hidden />
                  {nextSkillPath ? `${nextSkillPath.title} · ${nextSkill?.stage}` : "Learning"}
                </p>
                <h2 id="next-skill" className="text-2xl leading-tight font-bold sm:text-3xl">
                  {nextSkill
                    ? nextSkill.title
                    : pathProgress.length === 0
                      ? "No skills are published yet"
                      : "Every skill is done or waiting for a mentor"}
                </h2>
              </div>
              <Button asChild variant="cta" size="lg" className="self-start lg:self-auto">
                <Link to={nextSkill ? `/training/skills/${nextSkill._id}` : "/training"}>
                  {nextSkill ? "Continue" : "Open Learning"}
                  <ArrowRight />
                </Link>
              </Button>
            </div>
            {pathProgress.length > 0 && (
              <ul className="grid gap-4 border-t pt-6 sm:grid-cols-3">
                {pathProgress.map((path) => (
                  <li key={path.id} className="space-y-2">
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="truncate font-medium">{path.title}</span>
                      <span className="shrink-0 text-muted-foreground tabular-nums">
                        {path.done}/{path.total}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${path.percent}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      <section aria-label="Readiness" className={canReview ? "grid gap-3 sm:grid-cols-2 lg:grid-cols-4" : "grid gap-3 sm:grid-cols-2"}>
        <StatLink
          to="/tools"
          icon={Wrench}
          label="Tool sign-offs"
          value={equipment === undefined ? undefined : equipmentApprovalSummary?.approved ?? 0}
          detail={
            equipmentApprovalSummary && equipmentApprovalSummary.pending > 0
              ? `${equipmentApprovalSummary.pending} ${equipmentApprovalSummary.pending === 1 ? "tool still needs" : "tools still need"} a hands-on check`
              : "Every tool that needs a sign-off is done"
          }
        />
        <StatLink
          to="/badges"
          icon={Award}
          label="Badges earned"
          value={isLoadingBadges ? undefined : earnedVisibleBadgeCount}
          detail="Awarded when training and sign-offs are complete"
        />
        {canReview && (
          <StatLink
            to="/training/sign-offs"
            icon={UserCheck}
            label="Skill sign-offs waiting"
            value={signoffQueue === undefined ? undefined : signoffCount}
            detail="Students asking a mentor to check them off"
          />
        )}
        {canReview && (
          <StatLink
            to="/reviews"
            icon={ClipboardCheck}
            label="Tool checks waiting"
            value={reviewQueue === undefined ? undefined : handsOnReviewCount + lessonReviewCount}
            detail="Hands-on equipment checks and uploaded files"
          />
        )}
      </section>
    </div>
  );
}
