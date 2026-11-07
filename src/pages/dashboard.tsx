import { useConvexAuth } from "@convex-dev/auth/react";
import { Authenticated, Unauthenticated, useQuery } from "convex/react";
import {
  ArrowRight,
  Award,
  BookOpen,
  ClipboardCheck,
  Target,
  Wrench,
} from "lucide-react";
import { Link } from "react-router";

import { PageHeading } from "@/components/page-heading";
import { MissionGraphic } from "@/components/mission-graphic";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { canReviewLearning } from "@/lib/role-access";
import { useEffectiveRole } from "@/providers/role-preview-provider";
import { api } from "@convex/_generated/api";

function ProgressLink({
  to,
  label,
  badge,
  children,
}: {
  to: string;
  label: string;
  badge?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      className="block rounded-md border p-3 text-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none"
    >
      <div className="flex items-center justify-between gap-3">
        <span>{label}</span>
        {badge}
      </div>
      {children}
    </Link>
  );
}

export function DashboardPage() {
  const { isAuthenticated } = useConvexAuth();
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
  const equipmentApprovalLabel =
    equipment === undefined
      ? "..."
      : equipmentApprovalSummary && equipmentApprovalSummary.pending > 0
        ? `${equipmentApprovalSummary.pending} pending`
        : `${equipmentApprovalSummary?.approved ?? 0} approved`;
  const isLoadingBadges = badges === undefined || badgeAwards === undefined;
  const lessonReviewCount = reviewQueue?.lessonSubmissions.length ?? 0;
  const handsOnReviewCount = reviewQueue?.handsOnReviews.length ?? 0;
  const reviewCount = lessonReviewCount + handsOnReviewCount;
  const signoffCount = signoffQueue?.length ?? 0;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeading
        eyebrow="Dashboard"
        title="Command center"
        description="Start with the next action, then check readiness, reviews, and recognition."
        actions={<Badge variant="outline">Current role: {role}</Badge>}
      />

      <Unauthenticated>
        <Card>
          <CardHeader>
            <CardTitle>Sign in to see your dashboard</CardTitle>
            <CardDescription>
              Your dashboard is available after you sign in.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link to="/auth">Sign in</Link>
            </Button>
          </CardContent>
        </Card>
      </Unauthenticated>

      <Authenticated>
        <div className="space-y-5">
        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.75fr)]">
          <div className="rounded-md border bg-card p-5 shadow-sm">
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-stretch">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">
                    <Target className="size-3" />
                    Start here
                  </Badge>
                  {nextSkill && nextSkillPath && (
                    <Badge variant="outline">{nextSkillPath.title}</Badge>
                  )}
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-semibold sm:text-3xl">
                    {nextSkill
                      ? nextSkill.title
                      : learning === undefined
                        ? "Loading your next action"
                        : pathProgress.length === 0
                          ? "No skills published yet"
                          : "Every skill is done or waiting for a mentor"}
                  </h2>
                  <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                    {nextSkill
                      ? `Next up in ${nextSkill.stage}. Open it, learn it, then prove it with a self-check, a quiz, or a mentor sign-off.`
                      : "Use the readiness cards to review equipment approvals, badges, and other learning paths."}
                  </p>
                </div>
                {focusPath && focusPath.total > 0 && (
                  <div className="max-w-xl space-y-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{focusPath.title}</span>
                      <span>
                        {focusPath.done} of {focusPath.total} skills
                      </span>
                    </div>
                    <Progress value={focusPath.percent} />
                  </div>
                )}
                <Button asChild size="lg" className="w-full sm:w-auto">
                  <Link
                    to={nextSkill ? `/training/skills/${nextSkill._id}` : "/training"}
                  >
                    <ArrowRight className="size-4" />
                    {nextSkill ? "Open next skill" : "Open learning"}
                  </Link>
                </Button>
              </div>
              <MissionGraphic variant="learning" />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
            <ProgressLink
              to="/training"
              label="Learning"
              badge={
                <Badge variant="secondary">
                  <BookOpen className="size-3" />
                  {focusPath ? `${focusPath.done}/${focusPath.total}` : "..."}
                </Badge>
              }
            >
              <p className="mt-2 text-xs text-muted-foreground">
                {focusPath ? `Skills done in ${focusPath.title}` : "Skills done"}
              </p>
            </ProgressLink>
            <ProgressLink
              to="/equipment"
              label="Equipment"
              badge={
                <Badge
                  variant={
                    equipmentApprovalSummary && equipmentApprovalSummary.pending > 0
                      ? "outline"
                      : "secondary"
                  }
                >
                  <Wrench className="size-3" />
                  {equipmentApprovalLabel}
                </Badge>
              }
            >
              <p className="mt-2 text-xs text-muted-foreground">Hands-on approvals</p>
            </ProgressLink>
            <ProgressLink
              to="/badges"
              label="Badges"
              badge={
                <Badge>
                  <Award className="size-3" />
                  {isLoadingBadges ? "..." : earnedVisibleBadgeCount}
                </Badge>
              }
            >
              <p className="mt-2 text-xs text-muted-foreground">Earned recognition</p>
            </ProgressLink>
          </div>
        </section>

        {canReview && (
          <Card className="py-0">
            <CardHeader className="border-b bg-muted/25 px-5 py-4">
              <CardTitle className="flex items-center gap-2">
                <ClipboardCheck className="size-5 text-primary" />
                Mentor review queue
              </CardTitle>
              <CardDescription>
                Student submissions and hands-on demonstrations waiting for attention.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 px-5 py-5 sm:grid-cols-3">
              <ProgressLink
                to="/reviews"
                label="Open reviews"
                badge={
                  <Badge variant={reviewCount > 0 ? "default" : "outline"}>
                    {reviewQueue === undefined ? "..." : reviewCount}
                  </Badge>
                }
              />
              <ProgressLink
                to="/training/sign-offs"
                label="Skill sign-offs"
                badge={
                  <Badge variant={signoffCount > 0 ? "default" : "outline"}>
                    {signoffQueue === undefined ? "..." : signoffCount}
                  </Badge>
                }
              />
              <ProgressLink
                to="/reviews"
                label="Hands-on checks"
                badge={
                  <Badge variant="outline">
                    {reviewQueue === undefined ? "..." : handsOnReviewCount}
                  </Badge>
                }
              />
            </CardContent>
          </Card>
        )}

        <Card className="py-0">
          <CardHeader>
            <CardTitle>Progress detail</CardTitle>
            <CardDescription>
              Learning paths and supporting records in one place.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
              <div className="space-y-3">
                {learning === undefined ? (
                  <div className="rounded-md border p-3 text-sm text-muted-foreground">
                    Loading learning progress...
                  </div>
                ) : pathProgress.length === 0 ? (
                  <ProgressLink
                    to="/training"
                    label="Learning paths"
                    badge={<Badge variant="outline">None yet</Badge>}
                  >
                    <p className="mt-2 text-sm text-muted-foreground">
                      Skills show up here once mentors publish them.
                    </p>
                  </ProgressLink>
                ) : (
                  pathProgress.map((path) => (
                    <ProgressLink
                      key={path.id}
                      to="/training"
                      label={path.title}
                      badge={<span className="font-medium">{path.percent}%</span>}
                    >
                      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                        <span>
                          {path.done} of {path.total} skills done
                        </span>
                      </div>
                      <Progress value={path.percent} className="mt-2" />
                    </ProgressLink>
                  ))
                )}
              </div>
              <div className="grid gap-3 text-sm sm:grid-cols-3 lg:grid-cols-1">
                <ProgressLink
                  to="/training"
                  label="Learning"
                  badge={
                    <Badge variant="secondary">
                      <BookOpen className="size-3" />
                      {pathProgress.reduce((sum, path) => sum + path.done, 0)} skills
                    </Badge>
                  }
                />
                <ProgressLink
                  to="/equipment"
                  label="Equipment"
                  badge={
                    <Badge
                      variant={
                        equipmentApprovalSummary && equipmentApprovalSummary.pending > 0
                          ? "outline"
                          : "secondary"
                      }
                    >
                      <Wrench className="size-3" />
                      {equipmentApprovalLabel}
                    </Badge>
                  }
                />
                <ProgressLink
                  to="/badges"
                  label="Badges"
                  badge={
                    <Badge>
                      <Award className="size-3" />
                      {isLoadingBadges ? "..." : earnedVisibleBadgeCount}
                    </Badge>
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>
        </div>
      </Authenticated>
    </div>
  );
}
