import { useConvexAuth } from "@convex-dev/auth/react";
import { Authenticated, Unauthenticated, useMutation, useQuery } from "convex/react";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Layers3,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { MissionGraphic } from "@/components/mission-graphic";
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
import type { Id } from "@convex/_generated/dataModel";

export function TrainingPage() {
  const { isAuthenticated } = useConvexAuth();
  const viewer = useQuery(api.profiles.viewer, isAuthenticated ? {} : "skip");
  const tracks = useQuery(api.training.listTrainingTracks, isAuthenticated ? {} : "skip");
  const progress = useQuery(api.demo.myLessonProgress, isAuthenticated ? {} : "skip");
  const deleteLearningTrack = useMutation(api.training.deleteLearningTrack);
  const [deletingTrackId, setDeletingTrackId] = useState<Id<"trainingTracks"> | null>(null);
  const [trackPendingDelete, setTrackPendingDelete] = useState<{
    id: Id<"trainingTracks">;
    title: string;
  } | null>(null);
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
  const overallProgressPercent =
    totalVisibleLessons === 0
      ? 0
      : Math.round((completedVisibleLessons / totalVisibleLessons) * 100);
  const nextRequiredLesson = visibleTracks
    ?.flatMap((track) =>
      track.units.flatMap((unit) =>
        unit.lessons.map((lesson) => ({
          track,
          unit,
          lesson,
        })),
      ),
    )
    .find(
      (item) =>
        item.unit.isRequired &&
        item.lesson.required &&
        !completedLessonIds.has(item.lesson._id),
    );

  async function handleDeleteTrack() {
    if (!trackPendingDelete) {
      return;
    }

    setDeletingTrackId(trackPendingDelete.id);

    try {
      await deleteLearningTrack({ trackId: trackPendingDelete.id });
      toast.success("Learning track deleted");
      setTrackPendingDelete(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete track");
    } finally {
      setDeletingTrackId(null);
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeading
        eyebrow={activeProgramMeta.trainingTitle}
        title="Learning plan"
        description="Follow the next required step, then use tracks to understand the full path."
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
          <section className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_360px]">
            <div className="rounded-md border bg-card p-5 shadow-sm">
              <div className="grid h-full gap-5 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-stretch">
                <div className="flex flex-col justify-between gap-6">
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">Next required</Badge>
                    {nextRequiredLesson && (
                      <Badge variant="outline">{nextRequiredLesson.track.title}</Badge>
                    )}
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-2xl font-semibold sm:text-3xl">
                      {nextRequiredLesson
                        ? nextRequiredLesson.lesson.title
                        : visibleTracks === undefined
                          ? "Loading your plan"
                          : "Required learning is complete"}
                    </h2>
                    <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                      {nextRequiredLesson
                        ? `${nextRequiredLesson.unit.title} / ${
                            nextRequiredLesson.lesson.lessonType === "video_assignment" ||
                            nextRequiredLesson.lesson.lessonType === "exam"
                              ? "assignment due"
                              : "lesson to complete"
                          }`
                        : "Use the track list below to review completed work or open optional lessons."}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Overall learning progress</span>
                      <span>{overallProgressPercent}%</span>
                    </div>
                    <Progress value={overallProgressPercent} />
                  </div>
                  <Button asChild className="w-full sm:w-auto">
                    <Link
                      to={
                        nextRequiredLesson
                          ? `/training/lessons/${nextRequiredLesson.lesson._id}`
                          : "/dashboard"
                      }
                    >
                      <ArrowRight className="size-4" />
                      {nextRequiredLesson ? "Start next step" : "Back to dashboard"}
                    </Link>
                  </Button>
                </div>
                </div>
                <MissionGraphic variant="learning" />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              <div className="rounded-md border bg-card px-4 py-3 shadow-sm">
                <div className="font-semibold">{visibleTracks?.length ?? 0}</div>
                <div className="text-xs text-muted-foreground">Tracks available</div>
              </div>
              <div className="rounded-md border bg-card px-4 py-3 shadow-sm">
                <div className="font-semibold">{totalVisibleLessons}</div>
                <div className="text-xs text-muted-foreground">Lessons assigned</div>
              </div>
              <div className="rounded-md border bg-card px-4 py-3 shadow-sm">
                <div className="font-semibold">
                  {completedVisibleLessons}/{totalVisibleLessons}
                </div>
                <div className="text-xs text-muted-foreground">Lessons complete</div>
              </div>
            </div>
          </section>

          <div>
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <h2 className="font-semibold">Track roadmap</h2>
                <p className="text-sm text-muted-foreground">
                  Open a track to see units, lessons, and completion actions.
                </p>
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
                      <>
                        <Button asChild variant="ghost" size="icon" aria-label="Edit track">
                          <Link to={`/training/tracks/${track._id}/edit`}>
                            <Pencil className="size-4" />
                          </Link>
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            setTrackPendingDelete({
                              id: track._id,
                              title: track.title,
                            })
                          }
                          disabled={deletingTrackId === track._id}
                          aria-label={`Delete ${track.title}`}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </article>
              );
            })}
            </div>
          </div>
        </div>
      </Authenticated>
      <ConfirmDeleteDialog
        open={trackPendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) {
            setTrackPendingDelete(null);
          }
        }}
        title="Are you sure?"
        itemName={trackPendingDelete?.title ?? ""}
        itemType="learning track"
        description="This permanently removes the track, its units, lessons, quizzes, submissions, and student progress. This cannot be undone."
        confirmLabel="Delete track"
        isDeleting={trackPendingDelete ? deletingTrackId === trackPendingDelete.id : false}
        onConfirm={handleDeleteTrack}
      />
    </div>
  );
}
