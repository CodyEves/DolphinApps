import { useConvexAuth } from "@convex-dev/auth/react";
import { Authenticated, Unauthenticated, useMutation, useQuery } from "convex/react";
import { BookOpen, CheckCircle2, Clock, Pencil, PlayCircle, Plus } from "lucide-react";
import { Link } from "react-router";
import { toast } from "sonner";

import { PageHeading } from "@/components/page-heading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useUiStore } from "@/stores/use-ui-store";
import { api } from "@convex/_generated/api";

export function TrainingPage() {
  const { isAuthenticated } = useConvexAuth();
  const viewer = useQuery(api.profiles.viewer, isAuthenticated ? {} : "skip");
  const tracks = useQuery(api.training.listTrainingTracks, isAuthenticated ? {} : "skip");
  const progress = useQuery(api.demo.myLessonProgress, isAuthenticated ? {} : "skip");
  const seedDemoData = useMutation(api.demo.seedDemoData);
  const markDemoLessonComplete = useMutation(api.demo.markDemoLessonComplete);
  const selectedTrackId = useUiStore((state) => state.selectedTrainingTrackId);
  const setSelectedTrackId = useUiStore((state) => state.setSelectedTrainingTrackId);

  const isAdmin = viewer?.profile.role === "admin";
  const selectedTrack = tracks?.find((track) => track._id === selectedTrackId) ?? tracks?.[0];
  const completedLessonIds = new Set(progress?.map((item) => item.lessonId));

  async function handleSeedDemoData() {
    await seedDemoData({});
    toast.success("Demo training data is ready");
  }

  async function handleCompleteLesson(lessonId: string) {
    await markDemoLessonComplete({ lessonId });
    toast.success("Lesson marked complete");
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeading
        eyebrow="Training"
        title="Training tracks and units"
        description="A small Convex-backed demo for the future lesson catalog, video progress, quizzes, exercises, and unit completion."
        actions={
          <Authenticated>
            {isAdmin && (
              <Button asChild>
                <Link to="/training/tracks/new">
                  <Plus className="size-4" />
                  Create a new Learning Track
                </Link>
              </Button>
            )}
            <Button onClick={handleSeedDemoData} variant="outline">
              <Plus className="size-4" />
              Seed demo data
            </Button>
          </Authenticated>
        }
      />

      <Unauthenticated>
        <Card>
          <CardHeader>
            <CardTitle>Sign in to load training data</CardTitle>
            <CardDescription>
              Training tracks are stored in Convex and update live.
            </CardDescription>
          </CardHeader>
        </Card>
      </Unauthenticated>

      <Authenticated>
        <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
          <Card>
            <CardHeader>
              <CardTitle>Tracks</CardTitle>
              <CardDescription>
                These examples match common FRC training areas.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2">
              {tracks === undefined && (
                <p className="text-sm text-muted-foreground">Loading tracks...</p>
              )}
              {tracks?.length === 0 && (
                <div className="rounded-md border p-4 text-sm text-muted-foreground">
                  No tracks yet. Admins can create a learning track or seed demo
                  data to prove Convex mutations and queries are connected.
                </div>
              )}
              {tracks?.map((track) => (
                <div
                  key={track._id}
                  className="flex flex-col gap-3 rounded-md border p-4 transition-colors hover:bg-accent sm:flex-row sm:items-start sm:justify-between"
                >
                  <button
                    type="button"
                    onClick={() => setSelectedTrackId(track._id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{track.title}</p>
                        {!track.isPublished && <Badge variant="secondary">Draft</Badge>}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {track.description}
                      </p>
                    </div>
                  </button>
                  <div className="flex shrink-0 items-center gap-2">
                    {isAdmin && (
                      <Button asChild variant="ghost" size="sm">
                        <Link to={`/training/tracks/${track._id}/edit`}>
                          <Pencil className="size-4" />
                          Edit
                        </Link>
                      </Button>
                    )}
                    <Badge
                      variant={selectedTrack?._id === track._id ? "default" : "outline"}
                    >
                      {track.level}
                    </Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{selectedTrack?.title ?? "Training preview"}</CardTitle>
              <CardDescription>
                Lessons below represent the future YouTube video and progress model.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!selectedTrack && (
                <p className="text-sm text-muted-foreground">
                  Choose a track or seed demo data to preview lessons.
                </p>
              )}
              {selectedTrack?.lessons.map((lesson) => {
                const isComplete = completedLessonIds.has(lesson._id);

                return (
                  <div key={lesson._id} className="rounded-md border p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-2">
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
                        <p className="text-sm text-muted-foreground">
                          {lesson.description}
                        </p>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <Clock className="size-3" />
                            {lesson.estimatedMinutes} min
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <PlayCircle className="size-3" />
                            YouTube lesson placeholder
                          </span>
                        </div>
                      </div>
                      <Button
                        onClick={() => handleCompleteLesson(lesson._id)}
                        disabled={isComplete}
                        variant={isComplete ? "secondary" : "default"}
                      >
                        {isComplete ? "Completed" : "Mark complete"}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </CardContent>
            <Separator />
            <CardFooter className="pt-6 text-sm text-muted-foreground">
              Future work: embedded videos, quizzes, written exercises, unit
              completion rules, and badge triggers.
            </CardFooter>
          </Card>
        </div>
      </Authenticated>
    </div>
  );
}
