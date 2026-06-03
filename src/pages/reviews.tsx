import { useConvexAuth } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import {
  CheckCircle2,
  ClipboardCheck,
  ExternalLink,
  FileCheck2,
  LockKeyhole,
  Wrench,
  XCircle,
} from "lucide-react";
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
import { useEffectiveRole } from "@/providers/role-preview-provider";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";

function formatDate(timestamp: number | undefined) {
  if (!timestamp) {
    return "";
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function canReview(role: string) {
  return role === "admin" || role === "mentor" || role === "instructor";
}

export function ReviewsPage() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const viewer = useQuery(api.profiles.viewer, isAuthenticated ? {} : "skip");
  const effectiveRole = useEffectiveRole(viewer?.profile.role);
  const isReviewer = canReview(effectiveRole);
  const queue = useQuery(
    api.adminLms.listReviewQueue,
    isAuthenticated && isReviewer ? {} : "skip",
  );
  const reviewLessonSubmission = useMutation(api.adminLms.reviewLessonSubmission);
  const reviewHandsOnVerification = useMutation(api.adminLms.reviewHandsOnVerification);

  async function handleLessonReview(
    submissionId: Id<"exerciseSubmissions">,
    approved: boolean,
  ) {
    try {
      await reviewLessonSubmission({ submissionId, approved });
      toast.success(approved ? "Lesson submission approved" : "Revision requested");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to review submission");
    }
  }

  async function handleHandsOnReview(
    equipmentId: Id<"equipment">,
    userId: Id<"users">,
    approved: boolean,
  ) {
    try {
      await reviewHandsOnVerification({ equipmentId, userId, approved });
      toast.success(approved ? "Hands-on verification approved" : "Hands-on verification rejected");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to review sign-off");
    }
  }

  const lessonCount = queue?.lessonSubmissions.length ?? 0;
  const handsOnCount = queue?.handsOnReviews.length ?? 0;
  const totalCount = lessonCount + handsOnCount;

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl">
        <PageHeading
          eyebrow="Reviews"
          title="Review queue"
          description="Loading items that need attention."
        />
      </div>
    );
  }

  if (!isAuthenticated || !isReviewer) {
    return (
      <div className="mx-auto max-w-6xl">
        <PageHeading
          eyebrow="Reviews"
          title="Review queue"
          description="Review file submissions and hands-on equipment checks."
        />
        <Card>
          <CardHeader>
            <LockKeyhole className="size-5 text-primary" />
            <CardTitle>Review access required</CardTitle>
            <CardDescription>
              Sign in with an admin or mentor account to review student work.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeading
        eyebrow="Reviews"
        title="Review queue"
        description="Approve uploaded lesson files and verify hands-on equipment demonstrations."
        actions={<Badge variant={totalCount > 0 ? "default" : "outline"}>{totalCount} open</Badge>}
      />

      <div className="space-y-5">
        <div className="rounded-md border bg-card px-5 py-4 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
                <ClipboardCheck className="size-5" />
              </span>
              <div>
                <h2 className="font-semibold">Review desk</h2>
                <p className="text-sm text-muted-foreground">
                  Work through submissions, approve what is ready, and send revisions back quickly.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div className="rounded-md border bg-background px-3 py-2">
                <div className="font-semibold">{totalCount}</div>
                <div className="text-xs text-muted-foreground">Open</div>
              </div>
              <div className="rounded-md border bg-background px-3 py-2">
                <div className="font-semibold">{lessonCount}</div>
                <div className="text-xs text-muted-foreground">Lessons</div>
              </div>
              <div className="rounded-md border bg-background px-3 py-2">
                <div className="font-semibold">{handsOnCount}</div>
                <div className="text-xs text-muted-foreground">Hands-on</div>
              </div>
            </div>
          </div>
        </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="overflow-hidden py-0">
          <CardHeader className="border-b bg-muted/25 px-5 py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileCheck2 className="size-5 text-primary" />
                  Lesson file submissions
                </CardTitle>
                <CardDescription>Student uploads waiting for review.</CardDescription>
              </div>
              <Badge variant="outline">{lessonCount}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 px-5 py-5">
            {queue === undefined && (
              <p className="text-sm text-muted-foreground">Loading submissions...</p>
            )}
            {queue?.lessonSubmissions.length === 0 && (
              <div className="rounded-md border border-dashed bg-muted/20 p-5 text-center text-sm text-muted-foreground">
                <FileCheck2 className="mx-auto mb-2 size-7 text-primary" />
                No lesson files need review.
              </div>
            )}
            {queue?.lessonSubmissions.map((submission) => (
              <article key={submission._id} className="rounded-md border bg-background p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="font-medium">{submission.lessonTitle}</p>
                    <p className="text-sm text-muted-foreground">
                      {submission.studentName}
                      {submission.studentEmail ? ` · ${submission.studentEmail}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Submitted {formatDate(submission.createdAt)}
                    </p>
                  </div>
                  <Badge variant="secondary">{submission.trackTitle ?? "Lesson"}</Badge>
                </div>
                <p className="mt-3 text-sm">{submission.prompt}</p>
                <div className="mt-3 grid gap-2 sm:flex sm:flex-wrap">
                  {submission.fileUrl && (
                    <Button asChild variant="outline" size="sm" className="w-full sm:w-auto">
                      <a href={submission.fileUrl} target="_blank" rel="noreferrer">
                        <ExternalLink className="size-4" />
                        Open {submission.fileName}
                      </a>
                    </Button>
                  )}
                  <Button
                    size="sm"
                    className="w-full sm:w-auto"
                    onClick={() => void handleLessonReview(submission._id, true)}
                  >
                    <CheckCircle2 className="size-4" />
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full sm:w-auto"
                    onClick={() => void handleLessonReview(submission._id, false)}
                  >
                    <XCircle className="size-4" />
                    Needs revision
                  </Button>
                  <Button asChild size="sm" variant="ghost" className="w-full sm:w-auto">
                    <Link to={`/training/lessons/${submission.lessonId}`}>Open lesson</Link>
                  </Button>
                </div>
              </article>
            ))}
          </CardContent>
        </Card>

        <Card className="overflow-hidden py-0">
          <CardHeader className="border-b bg-muted/25 px-5 py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Wrench className="size-5 text-primary" />
                  Hands-on verifications
                </CardTitle>
                <CardDescription>Passed safety tests waiting for practical sign-off.</CardDescription>
              </div>
              <Badge variant="outline">{handsOnCount}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 px-5 py-5">
            {queue === undefined && (
              <p className="text-sm text-muted-foreground">Loading verifications...</p>
            )}
            {queue?.handsOnReviews.length === 0 && (
              <div className="rounded-md border border-dashed bg-muted/20 p-5 text-center text-sm text-muted-foreground">
                <Wrench className="mx-auto mb-2 size-7 text-primary" />
                No hands-on verifications need review.
              </div>
            )}
            {queue?.handsOnReviews.map((review) => (
              <article
                key={`${review.equipmentId}:${review.studentUserId}`}
                className="rounded-md border bg-background p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="font-medium">{review.equipmentName}</p>
                    <p className="text-sm text-muted-foreground">
                      {review.studentName}
                      {review.studentEmail ? ` · ${review.studentEmail}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Safety test passed {formatDate(review.passedAt)}
                      {review.scorePercent === undefined ? "" : ` · ${review.scorePercent}%`}
                    </p>
                  </div>
                  <Badge variant="outline">{review.status.replace("_", " ")}</Badge>
                </div>
                <div className="mt-3 grid gap-2 sm:flex sm:flex-wrap">
                  <Button
                    size="sm"
                    className="w-full sm:w-auto"
                    onClick={() =>
                      void handleHandsOnReview(review.equipmentId, review.studentUserId, true)
                    }
                  >
                    <CheckCircle2 className="size-4" />
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full sm:w-auto"
                    onClick={() =>
                      void handleHandsOnReview(review.equipmentId, review.studentUserId, false)
                    }
                  >
                    <XCircle className="size-4" />
                    Reject
                  </Button>
                  <Button asChild size="sm" variant="ghost" className="w-full sm:w-auto">
                    <Link to={`/equipment/${review.equipmentId}`}>Open equipment</Link>
                  </Button>
                </div>
              </article>
            ))}
          </CardContent>
        </Card>
      </div>
      </div>
    </div>
  );
}
