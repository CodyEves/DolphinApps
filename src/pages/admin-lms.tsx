import { useConvexAuth } from "@convex-dev/auth/react";
import { Authenticated, Unauthenticated, useMutation, useQuery } from "convex/react";
import {
  ArrowLeft,
  Award,
  BookOpen,
  ClipboardCheck,
  Database,
  FileQuestion,
  LockKeyhole,
  Plus,
  RotateCcw,
  Trash2,
  Wrench,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEffectiveRole } from "@/providers/role-preview-provider";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";

const managementAreas = [
  {
    title: "Learning tracks",
    description: "Create and edit learning tracks, units, lessons, videos, and quizzes.",
    href: "/training",
    action: "Open learning",
    icon: BookOpen,
  },
  {
    title: "New learning track",
    description: "Start a new course outline for lessons and safety content.",
    href: "/training/tracks/new",
    action: "Create track",
    icon: Plus,
  },
  {
    title: "Equipment",
    description: "Manage equipment records, SOP documents, safety tests, and sign-offs.",
    href: "/equipment",
    action: "Open equipment",
    icon: Wrench,
  },
  {
    title: "Badges",
    description: "Review badge categories and award criteria.",
    href: "/badges",
    action: "Open badges",
    icon: Award,
  },
];

export function AdminLmsPage() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const viewer = useQuery(api.profiles.viewer, isAuthenticated ? {} : "skip");
  const effectiveRole = useEffectiveRole(viewer?.profile.role);
  const isAdmin = effectiveRole === "admin";
  const users = useQuery(
    api.badges.listAwardableUsersForAdmin,
    isAuthenticated && isAdmin ? {} : "skip",
  );
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [savingAction, setSavingAction] = useState<string | null>(null);
  const progress = useQuery(
    api.adminLms.getUserProgressForAdmin,
    isAuthenticated && isAdmin && selectedUserId
      ? { userId: selectedUserId as Id<"users"> }
      : "skip",
  );
  const removeLessonProgress = useMutation(api.adminLms.removeLessonProgressForAdmin);
  const resetTrackProgress = useMutation(api.adminLms.resetTrackProgressForAdmin);
  const removeQuizAttempt = useMutation(api.adminLms.removeQuizAttemptForAdmin);
  const removeEquipmentSignOff = useMutation(api.adminLms.removeEquipmentSignOffForAdmin);

  async function handleRemoveLessonProgress(progressId: Id<"lessonProgress">) {
    setSavingAction(`lesson:${progressId}`);

    try {
      await removeLessonProgress({ progressId });
      toast.success("Lesson progress removed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to remove lesson progress");
    } finally {
      setSavingAction(null);
    }
  }

  async function handleResetTrackProgress(trackId: Id<"trainingTracks">) {
    if (!selectedUserId) {
      toast.error("Choose an account first.");
      return;
    }

    setSavingAction(`track:${trackId}`);

    try {
      const removedCount = await resetTrackProgress({
        userId: selectedUserId as Id<"users">,
        trackId,
      });
      toast.success(
        removedCount === 1
          ? "Removed 1 progress record"
          : `Removed ${removedCount} progress records`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to reset learning track");
    } finally {
      setSavingAction(null);
    }
  }

  async function handleRemoveQuizAttempt(attemptId: Id<"quizAttempts">) {
    setSavingAction(`quiz:${attemptId}`);

    try {
      await removeQuizAttempt({ attemptId });
      toast.success("Test attempt removed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to remove test attempt");
    } finally {
      setSavingAction(null);
    }
  }

  async function handleRemoveEquipmentSignOff(signOffId: Id<"equipmentSignOffs">) {
    setSavingAction(`signoff:${signOffId}`);

    try {
      await removeEquipmentSignOff({ signOffId });
      toast.success("Equipment sign-off removed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to remove sign-off");
    } finally {
      setSavingAction(null);
    }
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl">
        <PageHeading
          eyebrow="Admin"
          title="Learning management"
          description="Loading management tools."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeading
        eyebrow="Admin"
        title="Learning management"
        description="Manage learning content, safety tests, equipment requirements, SOPs, and recognition records."
        actions={
          <Button asChild variant="outline">
            <Link to="/management">
              <ArrowLeft className="size-4" />
              Back to admin
            </Link>
          </Button>
        }
      />

      <Unauthenticated>
        <Card>
          <CardHeader>
            <LockKeyhole className="size-5 text-primary" />
            <CardTitle>Sign in required</CardTitle>
            <CardDescription>
              Learning management requires an authenticated admin account.
            </CardDescription>
          </CardHeader>
        </Card>
      </Unauthenticated>

      <Authenticated>
        {!isAdmin ? (
          <Card>
            <CardHeader>
              <LockKeyhole className="size-5 text-primary" />
              <CardTitle>Admin access required</CardTitle>
              <CardDescription>
                Switch back to your actual role or sign in with an admin account.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <Database className="size-5 text-primary" />
                <CardTitle>Management areas</CardTitle>
                <CardDescription>
                  Jump to the current tools for editing learning content.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2">
                {managementAreas.map((area) => (
                  <div
                    key={area.href}
                    className="flex min-h-44 flex-col justify-between rounded-md border p-4"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <area.icon className="size-5 text-primary" />
                        <h2 className="font-semibold">{area.title}</h2>
                      </div>
                      <p className="text-sm leading-6 text-muted-foreground">
                        {area.description}
                      </p>
                    </div>
                    <Button asChild variant="outline" className="mt-4">
                      <Link to={area.href}>{area.action}</Link>
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <ClipboardCheck className="size-5 text-primary" />
                <CardTitle>Current coverage</CardTitle>
                <CardDescription>
                  Learning management uses the live learning and equipment builders.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Badge variant="outline">Tracks</Badge>
                <Badge variant="outline">Lessons</Badge>
                <Badge variant="outline">Quizzes</Badge>
                <Badge variant="outline">Equipment</Badge>
                <Badge variant="outline">SOP documents</Badge>
                <Badge variant="outline">Hands-on sign-offs</Badge>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <RotateCcw className="size-5 text-primary" />
                <CardTitle>Reset learning progress</CardTitle>
                <CardDescription>
                  Pull up an account and remove specific lessons, learning tracks, tests,
                  or equipment sign-offs.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Select
                  value={selectedUserId}
                  onValueChange={setSelectedUserId}
                  disabled={users === undefined}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Choose account to review" />
                  </SelectTrigger>
                  <SelectContent>
                    {users?.map((user) => (
                      <SelectItem key={user.userId} value={user.userId}>
                        {user.displayName ?? user.email ?? "Team member"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {!selectedUserId && (
                  <div className="rounded-md border p-4 text-sm text-muted-foreground">
                    Choose an account to see completed lessons, learning tracks, tests,
                    and equipment sign-offs.
                  </div>
                )}

                {selectedUserId && progress === undefined && (
                  <div className="rounded-md border p-4 text-sm text-muted-foreground">
                    Loading progress records.
                  </div>
                )}

                {progress && (
                  <div className="space-y-4">
                    <div className="rounded-md border p-4">
                      <p className="font-medium">
                        {progress.user.displayName ?? progress.user.email ?? "Team member"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {progress.user.email ?? "No email on file"}
                      </p>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <BookOpen className="size-4 text-primary" />
                          <h2 className="font-semibold">Learning tracks</h2>
                        </div>
                        {progress.trackProgress.length === 0 && (
                          <div className="rounded-md border p-4 text-sm text-muted-foreground">
                            No learning track progress yet.
                          </div>
                        )}
                        {progress.trackProgress.map((track) => (
                          <div
                            key={track.trackId}
                            className="flex flex-col gap-3 rounded-md border p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div>
                              <p className="font-medium">{track.title}</p>
                              <p className="text-muted-foreground">
                                {track.completedLessonCount} of {track.lessonCount} lessons complete
                              </p>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => void handleResetTrackProgress(track.trackId)}
                              disabled={savingAction === `track:${track.trackId}`}
                            >
                              <RotateCcw className="size-4" />
                              Reset track
                            </Button>
                          </div>
                        ))}
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <ClipboardCheck className="size-4 text-primary" />
                          <h2 className="font-semibold">Lessons</h2>
                        </div>
                        {progress.lessonProgress.length === 0 && (
                          <div className="rounded-md border p-4 text-sm text-muted-foreground">
                            No lesson progress yet.
                          </div>
                        )}
                        {progress.lessonProgress.map((lesson) => (
                          <div
                            key={lesson._id}
                            className="flex flex-col gap-3 rounded-md border p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div>
                              <p className="font-medium">{lesson.lessonTitle}</p>
                              <p className="text-muted-foreground">
                                {lesson.trackTitle} / {lesson.unitTitle}
                              </p>
                              <Badge variant={lesson.status === "completed" ? "default" : "outline"}>
                                {lesson.status.replace("_", " ")}
                              </Badge>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => void handleRemoveLessonProgress(lesson._id)}
                              disabled={savingAction === `lesson:${lesson._id}`}
                              aria-label={`Remove ${lesson.lessonTitle} progress`}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <FileQuestion className="size-4 text-primary" />
                          <h2 className="font-semibold">Tests</h2>
                        </div>
                        {progress.quizAttempts.length === 0 && (
                          <div className="rounded-md border p-4 text-sm text-muted-foreground">
                            No test attempts yet.
                          </div>
                        )}
                        {progress.quizAttempts.map((attempt) => (
                          <div
                            key={attempt._id}
                            className="flex flex-col gap-3 rounded-md border p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div>
                              <p className="font-medium">{attempt.quizTitle}</p>
                              <p className="text-muted-foreground">
                                {attempt.contextType}
                                {attempt.contextTitle ? ` / ${attempt.contextTitle}` : ""}
                              </p>
                              <Badge variant={attempt.status === "passed" ? "default" : "outline"}>
                                {attempt.status}
                                {attempt.scorePercent === undefined
                                  ? ""
                                  : ` ${attempt.scorePercent}%`}
                              </Badge>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => void handleRemoveQuizAttempt(attempt._id)}
                              disabled={savingAction === `quiz:${attempt._id}`}
                              aria-label={`Remove ${attempt.quizTitle} attempt`}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        ))}
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Wrench className="size-4 text-primary" />
                          <h2 className="font-semibold">Equipment sign-offs</h2>
                        </div>
                        {progress.equipmentSignOffs.length === 0 && (
                          <div className="rounded-md border p-4 text-sm text-muted-foreground">
                            No equipment sign-offs yet.
                          </div>
                        )}
                        {progress.equipmentSignOffs.map((signOff) => (
                          <div
                            key={signOff._id}
                            className="flex flex-col gap-3 rounded-md border p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div>
                              <p className="font-medium">{signOff.equipmentName}</p>
                              <Badge variant={signOff.status === "approved" ? "default" : "outline"}>
                                {signOff.status.replace("_", " ")}
                              </Badge>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => void handleRemoveEquipmentSignOff(signOff._id)}
                              disabled={savingAction === `signoff:${signOff._id}`}
                              aria-label={`Remove ${signOff.equipmentName} sign-off`}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </Authenticated>
    </div>
  );
}
