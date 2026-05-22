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
  const role = viewer?.profile.role ?? "student";
  const completedLessonIds = new Set(progress?.map((item) => item.lessonId));
  const trackProgress =
    tracks?.map((track) => {
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

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeading
        eyebrow="Dashboard"
        title="Team training overview"
        description="Role-aware placeholders for the student, instructor, and admin workflows this LMS will grow into."
        actions={<Badge variant="outline">Current role: {role}</Badge>}
      />

      <Unauthenticated>
        <Card>
          <CardHeader>
            <CardTitle>Sign in to see your dashboard</CardTitle>
            <CardDescription>
              Email/password authentication is wired through Convex Auth.
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
                {tracks === undefined || progress === undefined ? (
                  <div className="rounded-md border p-3 text-sm text-muted-foreground">
                    Loading learning path progress...
                  </div>
                ) : inProgressTracks.length === 0 ? (
                  <ProgressLink
                    to="/training"
                    label="Learning paths in progress"
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
                  label="Learning paths completed"
                  badge={
                    <Badge variant="secondary">
                      {completedTrackCount} of {totalTrackCount}
                    </Badge>
                  }
                />
                <ProgressLink
                  to="/equipment"
                  label="Equipment approvals"
                  badge={<Badge variant="outline">1 pending</Badge>}
                />
                <ProgressLink
                  to="/badges"
                  label="Badges earned"
                  badge={<Badge>1</Badge>}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </Authenticated>
    </div>
  );
}
