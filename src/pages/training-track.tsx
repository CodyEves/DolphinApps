import { useConvexAuth } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Clock,
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
import { Separator } from "@/components/ui/separator";
import { useEffectiveRole } from "@/providers/role-preview-provider";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";

function lessonTypeLabel(type: string) {
  if (type === "video_assignment") {
    return "Video + assignment";
  }

  if (type === "exam") {
    return "Questions / exam";
  }

  return "YouTube lesson";
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
          eyebrow="Learning Tracks"
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
          eyebrow="Learning Tracks"
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
          eyebrow="Learning Tracks"
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
    <div className="mx-auto max-w-5xl">
      <PageHeading
        eyebrow="Learning Tracks"
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

      <div className="space-y-4">
        {visibleTrack.units.length === 0 && (
          <Card>
            <CardHeader>
              <CardTitle>No units yet</CardTitle>
              <CardDescription>
                Lessons will appear here after this track is built.
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        {visibleTrack.units.map((unit, unitIndex) => (
          <Card key={unit._id}>
            <CardHeader>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">Unit {unitIndex + 1}</Badge>
                {unit.isRequired && <Badge variant="secondary">Required</Badge>}
              </div>
              <CardTitle>{unit.title}</CardTitle>
              {unit.description && (
                <CardDescription>{unit.description}</CardDescription>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {unit.lessons.length === 0 && (
                <p className="rounded-md border p-4 text-sm text-muted-foreground">
                  No lessons in this unit yet.
                </p>
              )}

              {unit.lessons.map((lesson) => {
                const isComplete = completedLessonIds.has(lesson._id);
                const canMarkComplete = lesson.lessonType === "video";

                return (
                  <div key={lesson._id} className="rounded-md border p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <Link
                        to={`/training/lessons/${lesson._id}`}
                        className="min-w-0 flex-1 space-y-2 rounded-md outline-none transition-colors hover:text-primary focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <BookOpen className="size-4 text-primary" />
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
                      </Link>
                      <div className="flex shrink-0 flex-col gap-2 sm:items-end">
                        <Button asChild variant="outline">
                          <Link to={`/training/lessons/${lesson._id}`}>
                            Open lesson
                          </Link>
                        </Button>
                        {canMarkComplete ? (
                          <Button
                            onClick={() => handleCompleteLesson(lesson._id)}
                            disabled={isComplete}
                            variant={isComplete ? "secondary" : "default"}
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
                  </div>
                );
              })}
            </CardContent>
            <Separator />
          </Card>
        ))}
      </div>
    </div>
  );
}
