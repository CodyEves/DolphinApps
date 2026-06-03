import { useConvexAuth } from "@convex-dev/auth/react";
import { Authenticated, Unauthenticated, useQuery } from "convex/react";
import {
  CheckCircle2,
  Clock,
  Layers3,
  Pencil,
  Plus,
  Sparkles,
} from "lucide-react";
import { Link } from "react-router";

import { PageHeading } from "@/components/page-heading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useProgramView } from "@/hooks/use-program-view";
import { useEffectiveRole } from "@/providers/role-preview-provider";
import { api } from "@convex/_generated/api";

export function TrainingPage() {
  const { isAuthenticated } = useConvexAuth();
  const viewer = useQuery(api.profiles.viewer, isAuthenticated ? {} : "skip");
  const tracks = useQuery(api.training.listTrainingTracks, isAuthenticated ? {} : "skip");
  const progress = useQuery(api.demo.myLessonProgress, isAuthenticated ? {} : "skip");
  const effectiveRole = useEffectiveRole(viewer?.profile.role);
  const { activeProgramMeta } = useProgramView();
  const isAdmin = effectiveRole === "admin";
  const visibleTracks = isAdmin
    ? tracks
    : tracks?.filter((track) => track.isPublished);
  const completedLessonIds = new Set(progress?.map((item) => item.lessonId) ?? []);
  const totalVisibleLessons =
    visibleTracks?.reduce((sum, track) => sum + track.lessons.length, 0) ?? 0;
  const completedVisibleLessons =
    visibleTracks?.reduce(
      (sum, track) =>
        sum +
        track.lessons.filter((lesson) => completedLessonIds.has(lesson._id)).length,
      0,
    ) ?? 0;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeading
        eyebrow={activeProgramMeta.trainingTitle}
        title="Learning tracks"
        description={activeProgramMeta.trainingDescription}
        actions={
          <Authenticated>
            {isAdmin && (
              <Button asChild>
                <Link to="/training/tracks/new">
                  <Plus className="size-4" />
                  Create a new learning track
                </Link>
              </Button>
            )}
          </Authenticated>
        }
      />

      <Unauthenticated>
        <Card className="border-dashed">
          <CardHeader className="items-center text-center">
            <Sparkles className="size-6 text-primary" />
            <CardTitle>Sign in to load learning data</CardTitle>
            <CardDescription>
              Sign in to view available learning tracks.
            </CardDescription>
          </CardHeader>
        </Card>
      </Unauthenticated>

      <Authenticated>
        <div className="space-y-5">
          <div className="rounded-md border bg-card px-5 py-4 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="font-semibold">Course dashboard</h2>
                <p className="text-sm text-muted-foreground">
                  Pick up where you left off or open a track to see the next lesson.
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                <div className="rounded-md border bg-background px-3 py-2 text-sm">
                  <div className="font-semibold">{visibleTracks?.length ?? 0}</div>
                  <div className="text-xs text-muted-foreground">Tracks</div>
                </div>
                <div className="rounded-md border bg-background px-3 py-2 text-sm">
                  <div className="font-semibold">{totalVisibleLessons}</div>
                  <div className="text-xs text-muted-foreground">Lessons</div>
                </div>
                <div className="rounded-md border bg-background px-3 py-2 text-sm">
                  <div className="font-semibold">
                    {completedVisibleLessons}/{totalVisibleLessons}
                  </div>
                  <div className="text-xs text-muted-foreground">Complete</div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visibleTracks === undefined && (
              <div className="rounded-md border p-5 text-sm text-muted-foreground">
                Loading tracks...
              </div>
            )}
            {visibleTracks?.length === 0 && (
              <div className="rounded-md border border-dashed bg-card p-6 text-center text-sm text-muted-foreground sm:col-span-2 xl:col-span-3">
                <Layers3 className="mx-auto mb-3 size-8 text-primary" />
                <p className="font-medium text-foreground">No tracks yet</p>
                <p>Admins can create a learning track to get started.</p>
              </div>
            )}
            {visibleTracks?.map((track) => {
              const totalLessons = track.lessons.length;
              const completedLessons = track.lessons.filter((lesson) =>
                completedLessonIds.has(lesson._id),
              ).length;
              const isComplete = totalLessons > 0 && completedLessons === totalLessons;
              const progressPercent =
                totalLessons === 0 ? 0 : Math.round((completedLessons / totalLessons) * 100);
              const minutes = track.lessons.reduce(
                (sum, lesson) => sum + lesson.estimatedMinutes,
                0,
              );

              return (
                <article
                  key={track._id}
                  className="flex min-h-64 flex-col justify-between gap-5 rounded-md border bg-card p-5 shadow-sm transition-colors hover:border-primary/50"
                >
                  <Link to={`/training/tracks/${track._id}`} className="space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
                        <Layers3 className="size-5" />
                      </span>
                      <div className="flex flex-wrap justify-end gap-2">
                      {!track.isPublished && <Badge variant="secondary">Draft</Badge>}
                      <Badge variant="outline">{track.level}</Badge>
                      {isComplete && (
                        <Badge>
                          <CheckCircle2 className="size-3" />
                          Complete
                        </Badge>
                      )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <h2 className="font-semibold">{track.title}</h2>
                      <p className="line-clamp-3 text-sm leading-6 text-muted-foreground">
                        {track.description}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{completedLessons} of {totalLessons} complete</span>
                        <span>{progressPercent}%</span>
                      </div>
                      <Progress value={progressPercent} />
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span>{track.units.length} units</span>
                      <span>{totalLessons} lessons</span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="size-3" />
                        {minutes} min
                      </span>
                    </div>
                  </Link>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button asChild className="flex-1">
                      <Link to={`/training/tracks/${track._id}`}>Open track</Link>
                    </Button>
                    {isAdmin && (
                      <Button asChild variant="ghost" size="icon" aria-label="Edit track">
                        <Link to={`/training/tracks/${track._id}/edit`}>
                          <Pencil className="size-4" />
                        </Link>
                      </Button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </Authenticated>
    </div>
  );
}
