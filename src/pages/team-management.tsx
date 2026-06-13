import { useConvexAuth } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import {
  ArrowRight,
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  LockKeyhole,
  Search,
  ShieldCheck,
  UserRoundCheck,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { canOpenManagement } from "@/lib/role-access";
import { useEffectiveRole } from "@/providers/role-preview-provider";
import { api } from "@convex/_generated/api";

const statusLabels = {
  all: "All statuses",
  needs_revision: "Needs revision",
  waiting_review: "Waiting review",
  in_progress: "In progress",
  not_started: "Not started",
  complete: "Complete",
} as const;

type StatusFilter = keyof typeof statusLabels;

function statusBadgeVariant(status: string) {
  if (status === "complete") {
    return "default" as const;
  }

  if (status === "needs_revision" || status === "waiting_review") {
    return "secondary" as const;
  }

  return "outline" as const;
}

function statusLabel(status: string) {
  return statusLabels[status as StatusFilter] ?? status.replace("_", " ");
}

function nextActionText(
  nextAction:
    | {
        status: string;
        pendingReviewCount: number;
        needsRevisionCount: number;
        nextLesson: { title: string; hasQuestions: boolean } | null;
      }
    | null
    | undefined,
) {
  if (!nextAction) {
    return "No assigned action";
  }

  if (nextAction.needsRevisionCount > 0) {
    return "Revise submitted work";
  }

  if (nextAction.pendingReviewCount > 0) {
    return "Waiting for mentor review";
  }

  if (nextAction.nextLesson) {
    return nextAction.nextLesson.hasQuestions
      ? `Complete assignment: ${nextAction.nextLesson.title}`
      : `Complete lesson: ${nextAction.nextLesson.title}`;
  }

  return statusLabel(nextAction.status);
}

export function TeamManagementPage() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const viewer = useQuery(api.profiles.viewer, isAuthenticated ? {} : "skip");
  const effectiveRole = useEffectiveRole(viewer?.profile.role);
  const hasManagementAccess = canOpenManagement(effectiveRole);
  const dashboard = useQuery(
    api.adminLms.listTeamLearningDashboard,
    isAuthenticated && hasManagementAccess ? {} : "skip",
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [trackFilter, setTrackFilter] = useState("all");

  const visibleStudents = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return (
      dashboard?.students.filter((student) => {
        const matchesSearch =
          !normalizedSearch ||
          [
            student.displayName,
            student.email,
            student.studentGroup,
            student.graduationYear ? String(student.graduationYear) : "",
          ]
            .filter(Boolean)
            .some((value) => value?.toLowerCase().includes(normalizedSearch));
        const matchesStatus = statusFilter === "all" || student.status === statusFilter;
        const matchesTrack =
          trackFilter === "all" ||
          student.tracks.some(
            (track) =>
              track.trackId === trackFilter &&
              (track.missingRequiredLessonCount > 0 ||
                track.pendingReviewCount > 0 ||
                track.needsRevisionCount > 0),
          );

        return matchesSearch && matchesStatus && matchesTrack;
      }) ?? []
    );
  }, [dashboard?.students, searchTerm, statusFilter, trackFilter]);
  const revisionStudents =
    dashboard?.students.filter((student) => student.status === "needs_revision").slice(0, 4) ??
    [];
  const reviewStudents =
    dashboard?.students.filter((student) => student.status === "waiting_review").slice(0, 4) ??
    [];
  const notStartedStudents =
    dashboard?.students.filter((student) => student.status === "not_started").slice(0, 4) ??
    [];

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl">
        <PageHeading
          eyebrow="Management"
          title="Team progress"
          description="Loading team learning records."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeading
        eyebrow="Management"
        title="Team progress"
        description="See who is complete, who is stuck, and what each student should do next."
        actions={
          <Button asChild variant="outline">
            <Link to="/management/reviews">
              <ClipboardCheck className="size-4" />
              Review queue
            </Link>
          </Button>
        }
      />

      {!isAuthenticated || !hasManagementAccess ? (
        <Card>
          <CardHeader>
            <LockKeyhole className="size-5 text-primary" />
            <CardTitle>Management access required</CardTitle>
            <CardDescription>
              Sign in with an admin or mentor account to use this area.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="space-y-5">
          <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="rounded-md border bg-card p-5 shadow-sm">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-3">
                  <Badge variant="secondary">
                    <ShieldCheck className="size-3" />
                    Mentor command center
                  </Badge>
                  <div>
                    <h2 className="text-2xl font-semibold sm:text-3xl">
                      {dashboard?.summary.pendingReviews || dashboard?.summary.revisionsNeeded
                        ? "Students need attention"
                        : "Team learning is on track"}
                    </h2>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                      Start with revisions and review items, then use the roster to coach
                      students toward their next required lesson.
                    </p>
                  </div>
                </div>
                <Button asChild className="w-full lg:w-auto">
                  <Link to="/management/reviews">
                    <ClipboardCheck className="size-4" />
                    Open review queue
                  </Link>
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-md border bg-card px-4 py-3 shadow-sm">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="size-4" />
                  Students
                </div>
                <p className="mt-1 text-2xl font-semibold">
                  {dashboard?.summary.students ?? "..."}
                </p>
              </div>
              <div className="rounded-md border bg-card px-4 py-3 shadow-sm">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <UserRoundCheck className="size-4" />
                  Complete
                </div>
                <p className="mt-1 text-2xl font-semibold">
                  {dashboard?.summary.complete ?? "..."}
                </p>
              </div>
              <div className="rounded-md border bg-card px-4 py-3 shadow-sm">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <ClipboardCheck className="size-4" />
                  Reviews
                </div>
                <p className="mt-1 text-2xl font-semibold">
                  {dashboard?.summary.pendingReviews ?? "..."}
                </p>
              </div>
              <div className="rounded-md border bg-card px-4 py-3 shadow-sm">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <ArrowRight className="size-4" />
                  Missing
                </div>
                <p className="mt-1 text-2xl font-semibold">
                  {dashboard?.summary.missingRequiredLessons ?? "..."}
                </p>
              </div>
            </div>
          </section>

          <section className="grid gap-4 xl:grid-cols-3">
            <Card className="py-0">
              <CardHeader className="border-b bg-muted/25 px-5 py-4">
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="size-5 text-primary" />
                  Needs revision
                </CardTitle>
                <CardDescription>Students with returned work.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 px-5 py-5">
                {revisionStudents.length === 0 && (
                  <div className="rounded-md border border-dashed bg-muted/20 p-3 text-sm text-muted-foreground">
                    No revisions waiting.
                  </div>
                )}
                {revisionStudents.map((student) => (
                  <Link
                    key={student.userId}
                    to={
                      student.nextAction?.nextLesson
                        ? `/training/lessons/${student.nextAction.nextLesson.lessonId}`
                        : "/management/team"
                    }
                    className="block rounded-md border p-3 text-sm transition-colors hover:bg-accent"
                  >
                    <p className="font-medium">{student.displayName}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {nextActionText(student.nextAction)}
                    </p>
                  </Link>
                ))}
              </CardContent>
            </Card>

            <Card className="py-0">
              <CardHeader className="border-b bg-muted/25 px-5 py-4">
                <CardTitle className="flex items-center gap-2">
                  <ClipboardCheck className="size-5 text-primary" />
                  Waiting review
                </CardTitle>
                <CardDescription>Work mentors can unblock.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 px-5 py-5">
                {reviewStudents.length === 0 && (
                  <div className="rounded-md border border-dashed bg-muted/20 p-3 text-sm text-muted-foreground">
                    Review queue is clear.
                  </div>
                )}
                {reviewStudents.map((student) => (
                  <Link
                    key={student.userId}
                    to="/management/reviews"
                    className="block rounded-md border p-3 text-sm transition-colors hover:bg-accent"
                  >
                    <p className="font-medium">{student.displayName}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {student.nextAction?.pendingReviewCount ?? 0} item(s) ready to review
                    </p>
                  </Link>
                ))}
              </CardContent>
            </Card>

            <Card className="py-0">
              <CardHeader className="border-b bg-muted/25 px-5 py-4">
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="size-5 text-primary" />
                  Not started
                </CardTitle>
                <CardDescription>Students who need a first step.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 px-5 py-5">
                {notStartedStudents.length === 0 && (
                  <div className="rounded-md border border-dashed bg-muted/20 p-3 text-sm text-muted-foreground">
                    Everyone has started assigned learning.
                  </div>
                )}
                {notStartedStudents.map((student) => (
                  <Link
                    key={student.userId}
                    to={
                      student.nextAction?.nextLesson
                        ? `/training/lessons/${student.nextAction.nextLesson.lessonId}`
                        : "/training"
                    }
                    className="block rounded-md border p-3 text-sm transition-colors hover:bg-accent"
                  >
                    <p className="font-medium">{student.displayName}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {student.nextAction?.trackTitle ?? "Open learning plan"}
                    </p>
                  </Link>
                ))}
              </CardContent>
            </Card>
          </section>

          <Card className="overflow-hidden py-0">
            <CardHeader className="border-b bg-muted/25 px-5 py-4">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <CardTitle>Student workflow</CardTitle>
                  <CardDescription>
                    Filter the roster and open the lesson or review step that moves each student forward.
                  </CardDescription>
                </div>
                <div className="grid gap-2 sm:grid-cols-[minmax(180px,1fr)_180px_220px]">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                      placeholder="Search students"
                      className="pl-9"
                    />
                  </div>
                  <Select
                    value={statusFilter}
                    onValueChange={(value) => setStatusFilter(value as StatusFilter)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(statusLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={trackFilter} onValueChange={setTrackFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Track" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All tracks</SelectItem>
                      {dashboard?.tracks.map((track) => (
                        <SelectItem key={track.trackId} value={track.trackId}>
                          {track.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 px-5 py-5">
              {dashboard === undefined && (
                <div className="rounded-md border p-4 text-sm text-muted-foreground">
                  Loading team progress.
                </div>
              )}
              {dashboard && visibleStudents.length === 0 && (
                <div className="rounded-md border border-dashed bg-muted/20 p-5 text-center text-sm text-muted-foreground">
                  No students match these filters.
                </div>
              )}
              {visibleStudents.map((student) => (
                <article key={student.userId} className="rounded-md border bg-background p-4 shadow-sm">
                  <div className="grid gap-4 xl:grid-cols-[minmax(180px,0.9fr)_minmax(220px,1.1fr)_minmax(260px,1.4fr)_auto] xl:items-center">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{student.displayName}</p>
                        <Badge variant={statusBadgeVariant(student.status)}>
                          {statusLabel(student.status)}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {student.studentGroup ?? "Student"}
                        {student.graduationYear ? ` / ${student.graduationYear}` : ""}
                      </p>
                      {student.email && (
                        <p className="truncate text-xs text-muted-foreground">
                          {student.email}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>
                          {student.totals.completedRequiredLessons} of{" "}
                          {student.totals.requiredLessons} required
                        </span>
                        <span>{student.percent}%</span>
                      </div>
                      <Progress value={student.percent} />
                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <span>{student.totals.missingRequiredLessons} missing</span>
                        <span>{student.totals.pendingReviews} reviews</span>
                        <span>{student.totals.revisionsNeeded} revisions</span>
                      </div>
                    </div>

                    <div className="rounded-md border bg-muted/20 p-3 text-sm">
                      <p className="font-medium">{nextActionText(student.nextAction)}</p>
                      {student.nextAction && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {student.nextAction.trackTitle}
                          {student.nextAction.nextLesson
                            ? ` / ${student.nextAction.nextLesson.unitTitle}`
                            : ""}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row xl:flex-col">
                      {student.nextAction?.pendingReviewCount ? (
                        <Button asChild size="sm" className="w-full">
                          <Link to="/management/reviews">
                            <ClipboardCheck className="size-4" />
                            Review
                          </Link>
                        </Button>
                      ) : student.nextAction?.nextLesson ? (
                        <Button asChild size="sm" className="w-full">
                          <Link to={`/training/lessons/${student.nextAction.nextLesson.lessonId}`}>
                            <ArrowRight className="size-4" />
                            Open lesson
                          </Link>
                        </Button>
                      ) : (
                        <Button asChild size="sm" variant="outline" className="w-full">
                          <Link to="/training">
                            <CheckCircle2 className="size-4" />
                            Learning
                          </Link>
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                    {student.tracks.map((track) => (
                      <Link
                        key={track.trackId}
                        to={`/training/tracks/${track.trackId}`}
                        className="rounded-md border p-3 text-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="min-w-0 truncate font-medium">{track.title}</span>
                          <Badge variant={statusBadgeVariant(track.status)}>
                            {track.percent}%
                          </Badge>
                        </div>
                        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                          <span>
                            {track.completedRequiredLessonCount} of{" "}
                            {track.requiredLessonCount} required
                          </span>
                          {track.pendingReviewCount > 0 && (
                            <span>{track.pendingReviewCount} review</span>
                          )}
                          {track.needsRevisionCount > 0 && (
                            <span>{track.needsRevisionCount} revision</span>
                          )}
                        </div>
                        <Progress value={track.percent} className="mt-2" />
                      </Link>
                    ))}
                  </div>
                </article>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
