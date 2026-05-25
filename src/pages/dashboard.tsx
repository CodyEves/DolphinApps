import { useConvexAuth } from "@convex-dev/auth/react";
import { Authenticated, Unauthenticated, useQuery } from "convex/react";
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
  const canReview = role === "admin" || role === "mentor" || role === "instructor";
  const reviewQueue = useQuery(
    api.adminLms.listReviewQueue,
    isAuthenticated && canReview ? {} : "skip",
  );
  const completedLessonIds = new Set(progress?.map((item) => item.lessonId));
  const earnedBadgeIds = new Set(badgeAwards?.map((award) => award.badgeId));
  const visibleTracks =
    role === "admin" ? tracks : tracks?.filter((track) => track.isPublished);
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
        title="Team training overview"
        description="Review your training, equipment approvals, and badge progress."
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
              <Link to="/auth">Sign in or create account</Link>
            </Button>
          </CardContent>
        </Card>
      </Unauthenticated>

      <Authenticated>
        <div className="space-y-4">
        {canReview && (
          <Card>
            <CardHeader>
              <CardTitle>Needs review</CardTitle>
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

        <Card>
          <CardHeader>
            <CardTitle>My progress</CardTitle>
            <CardDescription>
              Your training, equipment, and badge progress in one place.
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
                  label="Learning tracks completed"
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
              </div>
            </div>
          </CardContent>
        </Card>
        </div>
      </Authenticated>
    </div>
  );
}
