import { useMutation, useQuery } from "convex/react";
import { CheckCircle2, ExternalLink, FileCheck2, LockKeyhole, Wrench, XCircle } from "lucide-react";
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
  const viewer = useQuery(api.profiles.viewer, {});
  const effectiveRole = useEffectiveRole(viewer?.profile.role);
  const isReviewer = canReview(effectiveRole);
  const queue = useQuery(
    api.adminLms.listReviewQueue,
    isReviewer ? {} : "skip",
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

  if (!isReviewer) {
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

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
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
          <CardContent className="space-y-3">
            {queue === undefined && (
              <p className="text-sm text-muted-foreground">Loading submissions...</p>
            )}
            {queue?.lessonSubmissions.length === 0 && (
              <p className="rounded-md border p-4 text-sm text-muted-foreground">
                No lesson files need review.
              </p>
            )}
            {queue?.lessonSubmissions.map((submission) => (
              <div key={submission._id} className="rounded-md border p-4">
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
                <div className="mt-3 flex flex-wrap gap-2">
                  {submission.fileUrl && (
                    <Button asChild variant="outline" size="sm">
                      <a href={submission.fileUrl} target="_blank" rel="noreferrer">
                        <ExternalLink className="size-4" />
                        Open {submission.fileName}
                      </a>
                    </Button>
                  )}
                  <Button size="sm" onClick={() => void handleLessonReview(submission._id, true)}>
                    <CheckCircle2 className="size-4" />
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void handleLessonReview(submission._id, false)}
                  >
                    <XCircle className="size-4" />
                    Needs revision
                  </Button>
                  <Button asChild size="sm" variant="ghost">
                    <Link to={`/training/lessons/${submission.lessonId}`}>Open lesson</Link>
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
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
          <CardContent className="space-y-3">
            {queue === undefined && (
              <p className="text-sm text-muted-foreground">Loading verifications...</p>
            )}
            {queue?.handsOnReviews.length === 0 && (
              <p className="rounded-md border p-4 text-sm text-muted-foreground">
                No hands-on verifications need review.
              </p>
            )}
            {queue?.handsOnReviews.map((review) => (
              <div
                key={`${review.equipmentId}:${review.studentUserId}`}
                className="rounded-md border p-4"
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
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    size="sm"
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
                    onClick={() =>
                      void handleHandsOnReview(review.equipmentId, review.studentUserId, false)
                    }
                  >
                    <XCircle className="size-4" />
                    Reject
                  </Button>
                  <Button asChild size="sm" variant="ghost">
                    <Link to={`/equipment/${review.equipmentId}`}>Open equipment</Link>
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
