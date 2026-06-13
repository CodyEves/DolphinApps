import { useConvexAuth } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  Clock,
  FileQuestion,
  Film,
  Layers3,
  Pencil,
  PlayCircle,
} from "lucide-react";
import { Link, useParams } from "react-router";
import { toast } from "sonner";

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
import type { Id } from "@convex/_generated/dataModel";

function lessonTypeLabel(type: string) {
  if (type === "video_assignment") {
    return "Assignment";
  }

  if (type === "exam") {
    return "Quiz or exam";
  }

  return "Video lesson";
}

function LessonTypeIcon({
  type,
  className = "size-5",
}: {
  type: string;
  className?: string;
}) {
  if (type === "video_assignment") {
    return <ClipboardList className={className} />;
  }

  if (type === "exam") {
    return <FileQuestion className={className} />;
  }

  return <Film className={className} />;
}

export function TrainingTrackPage() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const params = useParams();
  const trackId = params.trackId as Id<"trainingTracks"> | undefined;
  const viewer = useQuery(api.profiles.viewer, isAuthenticated ? {} : "skip");
  const track = useQuery(
    api.training.getTrainingTrackForStudent,
    isAuthenticated && trackId ? { trackId } : "skip",
  );
  const progress = useQuery(api.demo.myLessonProgress, isAuthenticated ? {} : "skip");
  const markDemoLessonComplete = useMutation(api.demo.markDemoLessonComplete);
  const effectiveRole = useEffectiveRole(viewer?.profile.role);
  const isAdmin = effectiveRole === "admin";
  const visibleTrack = track && (isAdmin || track.isPublished) ? track : null;
  const completedLessonIds = new Set(progress?.map((item) => item.lessonId));
  const totalLessons = visibleTrack?.lessons.length ?? 0;
  const completedLessons =
    visibleTrack?.lessons.filter((lesson) => completedLessonIds.has(lesson._id)).length ??
    0;
  const progressPercent =
    totalLessons === 0 ? 0 : Math.round((completedLessons / totalLessons) * 100);
  const estimatedMinutes =
    visibleTrack?.lessons.reduce((sum, lesson) => sum + lesson.estimatedMinutes, 0) ??
    0;
  const nextLesson = visibleTrack?.units
    .flatMap((unit) =>
      unit.lessons.map((lesson) => ({
        unit,
        lesson,
      })),
    )
    .find((item) => item.lesson.required && !completedLessonIds.has(item.lesson._id));
  const requiredLessons =
    visibleTrack?.lessons.filter((lesson) => lesson.required).length ?? 0;

  async function handleCompleteLesson(lessonId: string) {
    try {
      await markDemoLessonComplete({ lessonId });
      toast.success("Lesson marked complete");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to complete lesson");
    }
  }

  if (isLoading || (isAuthenticated && track === undefined)) {
    return (
      <div className="mx-auto max-w-5xl">
        <PageHeading
          eyebrow="Learning"
          title="Learning track"
          description="Loading track lessons."
        />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-5xl">
        <PageHeading
          eyebrow="Learning"
          title="Sign in required"
          description="Sign in to open learning tracks."
          actions={
            <Button asChild variant="outline">
              <Link to="/training">
                <ArrowLeft className="size-4" />
                Back to learning tracks
              </Link>
            </Button>
          }
        />
      </div>
    );
  }

  if (!visibleTrack) {
    return (
      <div className="mx-auto max-w-5xl">
        <PageHeading
          eyebrow="Learning"
          title="Track not found"
          description="This learning track is not available."
          actions={
            <Button asChild variant="outline">
              <Link to="/training">
                <ArrowLeft className="size-4" />
                Back to learning tracks
              </Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeading
        eyebrow="Learning"
        title={visibleTrack.title}
        description={visibleTrack.description}
        actions={
          <>
            {isAdmin && (
              <Button asChild variant="secondary">
                <Link to={`/training/tracks/${visibleTrack._id}/edit`}>
                  <Pencil className="size-4" />
                  Edit track
                </Link>
              </Button>
            )}
            <Button asChild variant="outline">
              <Link to="/training">
                <ArrowLeft className="size-4" />
                Back to learning tracks
              </Link>
            </Button>
          </>
        }
      />

      <div className="space-y-5">
        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="rounded-md border bg-card p-5 shadow-sm">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{visibleTrack.level}</Badge>
                {!visibleTrack.isPublished && <Badge variant="secondary">Draft</Badge>}
                {requiredLessons > 0 && <Badge variant="secondary">{requiredLessons} required</Badge>}
              </div>
              <h2 className="text-2xl font-semibold">
                {nextLesson ? `Continue: ${nextLesson.lesson.title}` : "Track complete"}
              </h2>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                {nextLesson
                  ? `${nextLesson.unit.title} is the next required item in this track.`
                  : "Every lesson in this track has been completed."}
              </p>
              <div className="max-w-2xl space-y-2 pt-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{completedLessons} of {totalLessons} lessons complete</span>
                  <span>{progressPercent}%</span>
                </div>
                <Progress value={progressPercent} />
              </div>
              <div className="pt-3">
                <Button asChild className="w-full sm:w-auto">
                  <Link
                    to={
                      nextLesson
                        ? `/training/lessons/${nextLesson.lesson._id}`
                        : "/training"
                    }
                  >
                    {nextLesson ? "Open next lesson" : "Back to learning"}
                  </Link>
                </Button>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-sm lg:grid-cols-1">
            <div className="rounded-md border bg-card px-4 py-3 shadow-sm">
              <div className="font-semibold">{visibleTrack.units.length}</div>
              <div className="text-xs text-muted-foreground">Units</div>
            </div>
            <div className="rounded-md border bg-card px-4 py-3 shadow-sm">
              <div className="font-semibold">{totalLessons}</div>
              <div className="text-xs text-muted-foreground">Lessons</div>
            </div>
            <div className="rounded-md border bg-card px-4 py-3 shadow-sm">
              <div className="font-semibold">{estimatedMinutes}</div>
              <div className="text-xs text-muted-foreground">Minutes</div>
            </div>
          </div>
        </section>

        {visibleTrack.units.length === 0 && (
          <Card className="border-dashed">
            <CardHeader className="items-center text-center">
              <Layers3 className="size-8 text-primary" />
              <CardTitle>No units yet</CardTitle>
              <CardDescription>
                Lessons will appear here after this track is built.
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        <section className="space-y-4">
          <div>
            <h2 className="font-semibold">Unit roadmap</h2>
            <p className="text-sm text-muted-foreground">
              Work through required lessons in order. Assignments and exams complete inside the lesson.
            </p>
          </div>

        {visibleTrack.units.map((unit, unitIndex) => (
          <Card key={unit._id} className="overflow-hidden py-0">
            <CardHeader className="border-b bg-muted/25 px-5 py-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground">
                    {unitIndex + 1}
                  </span>
                  <div>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Badge variant="outline">Unit {unitIndex + 1}</Badge>
                    {unit.isRequired && <Badge variant="secondary">Required</Badge>}
                  </div>
                  <CardTitle>{unit.title}</CardTitle>
                  {unit.description && (
                    <CardDescription>{unit.description}</CardDescription>
                  )}
                  </div>
                </div>
                <Badge variant="outline">{unit.lessons.length} lessons</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 px-5 py-5">
              {unit.lessons.length === 0 && (
                <p className="rounded-md border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
                  No lessons in this unit yet.
                </p>
              )}

              {unit.lessons.map((lesson, lessonIndex) => {
                const isComplete = completedLessonIds.has(lesson._id);
                const canMarkComplete = lesson.lessonType === "video";
                return (
                  <article key={lesson._id} className="rounded-md border bg-background p-4 shadow-sm">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <Link
                        to={`/training/lessons/${lesson._id}`}
                        className="min-w-0 flex-1 rounded-md outline-none transition-colors hover:text-primary focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                      >
                        <div className="flex items-start gap-3">
                          <span className="relative flex size-10 shrink-0 items-center justify-center rounded-full border bg-card text-secondary-foreground">
                            {isComplete ? (
                              <CheckCircle2 className="size-5 text-primary" />
                            ) : (
                              <LessonTypeIcon type={lesson.lessonType} />
                            )}
                          </span>
                          <div className="min-w-0 space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="outline">Lesson {lessonIndex + 1}</Badge>
                              <h2 className="font-medium">{lesson.title}</h2>
                              {lesson.required && <Badge variant="secondary">Required</Badge>}
                              {isComplete && (
                                <Badge>
                                  <CheckCircle2 className="size-3" />
                                  Complete
                                </Badge>
                              )}
                            </div>
                            {lesson.description && (
                              <p className="text-sm text-muted-foreground">
                                {lesson.description}
                              </p>
                            )}
                            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                              <span className="inline-flex items-center gap-1">
                                <Clock className="size-3" />
                                {lesson.estimatedMinutes} min
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <PlayCircle className="size-3" />
                                {lessonTypeLabel(lesson.lessonType)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </Link>
                      <div className="flex shrink-0 flex-col gap-2 sm:items-end">
                        <Button asChild className="w-full sm:w-auto">
                          <Link to={`/training/lessons/${lesson._id}`}>
                            Open lesson
                          </Link>
                        </Button>
                        {canMarkComplete ? (
                          <Button
                            onClick={() => handleCompleteLesson(lesson._id)}
                            disabled={isComplete}
                            variant={isComplete ? "secondary" : "default"}
                            className="w-full sm:w-auto"
                          >
                            {isComplete ? "Completed" : "Mark complete"}
                          </Button>
                        ) : (
                          <Badge variant={isComplete ? "default" : "outline"}>
                            {isComplete ? "Completed" : "Complete in lesson"}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </CardContent>
          </Card>
        ))}
        </section>
      </div>
    </div>
  );
}
