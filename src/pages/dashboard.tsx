import { useConvexAuth } from "@convex-dev/auth/react";
import { Authenticated, Unauthenticated, useQuery } from "convex/react";
import {
  ArrowRight,
  Award,
  BookOpen,
  ClipboardCheck,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { Link } from "react-router";

import { PageHeading } from "@/components/page-heading";
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
import { canReviewLearning, isAdminRole } from "@/lib/role-access";
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
  const tracks = useQuery(api.training.listTrainingTracks, isAuthenticated ? {} : "skip");
  const progress = useQuery(api.demo.myLessonProgress, isAuthenticated ? {} : "skip");
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
  const completedLessonIds = new Set(progress?.map((item) => item.lessonId));
  const earnedBadgeIds = new Set(badgeAwards?.map((award) => award.badgeId));
  const visibleTracks =
    isAdminRole(role) ? tracks : tracks?.filter((track) => track.isPublished);
  const trackProgress =
    visibleTracks?.map((track) => {
      const completedLessons = track.lessons.filter((lesson) =>
        completedLessonIds.has(lesson._id),
      ).length;
      const totalLessons = track.lessons.length;
      const percent =
        totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

      return {
        id: track._id,
        title: track.title,
        completedLessons,
        totalLessons,
        percent,
        isStarted: completedLessons > 0,
        isComplete: totalLessons > 0 && completedLessons === totalLessons,
      };
    }) ?? [];
  const inProgressTracks = trackProgress.filter(
    (track) => track.isStarted && !track.isComplete,
  );
  const nextTrack =
    trackProgress.find((track) => track.isStarted && !track.isComplete) ??
    trackProgress.find((track) => !track.isComplete && track.totalLessons > 0);
  const completedTrackCount = trackProgress.filter((track) => track.isComplete).length;
  const totalTrackCount = trackProgress.filter((track) => track.totalLessons > 0).length;
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

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeading
        eyebrow="Dashboard"
        title="Your team workspace"
        description="Continue learning, clear equipment approvals, and keep an eye on recognition progress."
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
        <div className="space-y-4">
        {canReview && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardCheck className="size-5 text-primary" />
                Needs review
              </CardTitle>
              <CardDescription>
                Student submissions and hands-on demonstrations waiting for attention.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-3">
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
                to="/reviews"
                label="Lesson files"
                badge={
                  <Badge variant="outline">
                    {reviewQueue === undefined ? "..." : lessonReviewCount}
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

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <Card className="overflow-hidden py-0">
            <CardHeader className="border-b bg-muted/25 px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="size-5 text-primary" />
                    Next learning step
                  </CardTitle>
                  <CardDescription>
                    The fastest path back into your training.
                  </CardDescription>
                </div>
                {nextTrack && <Badge variant="outline">{nextTrack.percent}%</Badge>}
              </div>
            </CardHeader>
            <CardContent className="space-y-4 px-5 py-5">
              {visibleTracks === undefined || progress === undefined ? (
                <div className="rounded-md border p-4 text-sm text-muted-foreground">
                  Loading your next step.
                </div>
              ) : nextTrack ? (
                <ProgressLink
                  to={`/training/tracks/${nextTrack.id}`}
                  label={nextTrack.title}
                  badge={<ArrowRight className="size-4 text-primary" />}
                >
                  <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {nextTrack.completedLessons} of {nextTrack.totalLessons} lessons complete
                    </span>
                    <span>{nextTrack.percent}%</span>
                  </div>
                  <Progress value={nextTrack.percent} className="mt-2" />
                </ProgressLink>
              ) : (
                <div className="rounded-md border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
                  All available learning tracks are complete.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="py-0">
            <CardHeader className="border-b bg-muted/25 px-5 py-4">
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="size-5 text-primary" />
                Readiness
              </CardTitle>
              <CardDescription>Training, approvals, and badges.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 px-5 py-5 text-sm">
              <ProgressLink
                to="/training"
                label="Learning tracks"
                badge={
                  <Badge variant="secondary">
                    {completedTrackCount} of {totalTrackCount}
                  </Badge>
                }
              />
              <ProgressLink
                to="/equipment"
                label="Equipment approvals"
                badge={
                  <Badge
                    variant={
                      equipmentApprovalSummary && equipmentApprovalSummary.pending > 0
                        ? "outline"
                        : "secondary"
                    }
                  >
                    {equipmentApprovalLabel}
                  </Badge>
                }
              />
              <ProgressLink
                to="/badges"
                label="Badges earned"
                badge={<Badge>{isLoadingBadges ? "..." : earnedVisibleBadgeCount}</Badge>}
              />
            </CardContent>
          </Card>
        </section>

        <Card className="py-0">
          <CardHeader>
            <CardTitle>Progress detail</CardTitle>
            <CardDescription>
              Active tracks and supporting records in one place.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
              <div className="space-y-3">
                {visibleTracks === undefined || progress === undefined ? (
                  <div className="rounded-md border p-3 text-sm text-muted-foreground">
                    Loading learning track progress...
                  </div>
                ) : inProgressTracks.length === 0 ? (
                  <ProgressLink
                    to="/training"
                    label="Learning tracks in progress"
                    badge={<Badge variant="outline">0 active</Badge>}
                  >
                    <p className="mt-2 text-sm text-muted-foreground">
                      Start a learning track to see progress bars here.
                    </p>
                  </ProgressLink>
                ) : (
                  inProgressTracks.map((track) => (
                    <ProgressLink
                      key={track.id}
                      to={`/training/tracks/${track.id}`}
                      label={track.title}
                      badge={<span className="font-medium">{track.percent}%</span>}
                    >
                      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                        <span>
                          {track.completedLessons} of {track.totalLessons} lessons complete
                        </span>
                      </div>
                      <Progress value={track.percent} className="mt-2" />
                    </ProgressLink>
                  ))
                )}
              </div>
              <div className="grid gap-3 text-sm sm:grid-cols-3 lg:grid-cols-1">
                <ProgressLink
                  to="/training"
                  label="Training"
                  badge={
                    <Badge variant="secondary">
                      <BookOpen className="size-3" />
                      {completedTrackCount} of {totalTrackCount}
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
