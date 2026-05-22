import { useConvexAuth } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  PlayCircle,
  RotateCcw,
} from "lucide-react";
import { useState } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";

function youtubeEmbedUrl(url: string | undefined) {
  if (!url) {
    return null;
  }

  try {
    const parsedUrl = new URL(url);
    const host = parsedUrl.hostname.replace(/^www\./, "");
    let videoId: string | null = null;

    if (host === "youtu.be") {
      videoId = parsedUrl.pathname.split("/").filter(Boolean)[0] ?? null;
    } else if (host.endsWith("youtube.com")) {
      if (parsedUrl.pathname.startsWith("/embed/")) {
        videoId = parsedUrl.pathname.split("/").filter(Boolean)[1] ?? null;
      } else if (parsedUrl.pathname.startsWith("/shorts/")) {
        videoId = parsedUrl.pathname.split("/").filter(Boolean)[1] ?? null;
      } else {
        videoId = parsedUrl.searchParams.get("v");
      }
    }

    if (!videoId) {
      return null;
    }

    const embedUrl = new URL(`https://www.youtube.com/embed/${videoId}`);
    embedUrl.searchParams.set("rel", "0");
    embedUrl.searchParams.set("modestbranding", "1");

    if (typeof window !== "undefined") {
      embedUrl.searchParams.set("origin", window.location.origin);
    }

    return embedUrl.toString();
  } catch {
    return null;
  }
}

function externalVideoUrl(url: string | undefined) {
  if (!url) {
    return null;
  }

  try {
    return new URL(url).toString();
  } catch {
    return null;
  }
}

function questionTypeLabel(type: string) {
  if (type === "multiple_choice") {
    return "Multiple choice";
  }

  if (type === "fill_blank") {
    return "Fill in the blank";
  }

  if (type === "file_upload") {
    return "File upload";
  }

  if (type === "true_false") {
    return "True / false";
  }

  return "Short answer";
}

function lessonTypeLabel(type: string) {
  if (type === "video_assignment") {
    return "Video + assignment";
  }

  if (type === "exam") {
    return "Questions / exam";
  }

  return "Video";
}

export function LessonViewPage() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const params = useParams();
  const lessonId = params.lessonId as Id<"lessons"> | undefined;
  const content = useQuery(
    api.training.getLessonForStudent,
    isAuthenticated && lessonId ? { lessonId } : "skip",
  );
  const progress = useQuery(api.demo.myLessonProgress, isAuthenticated ? {} : "skip");
  const markDemoLessonComplete = useMutation(api.demo.markDemoLessonComplete);
  const resetMyLessonProgress = useMutation(api.demo.resetMyLessonProgress);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});

  const isComplete = progress?.some((item) => item.lessonId === lessonId) ?? false;
  const embedUrl = youtubeEmbedUrl(content?.lesson.youtubeUrl);
  const videoUrl = externalVideoUrl(content?.lesson.youtubeUrl);
  const hasQuestions = content !== undefined && content !== null && content.questions.length > 0;

  async function handleCompleteLesson() {
    if (!lessonId) {
      return;
    }

    try {
      await markDemoLessonComplete({ lessonId });
      toast.success("Lesson marked complete");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update progress");
    }
  }

  async function handleResetProgress() {
    try {
      await resetMyLessonProgress({});
      toast.success("Completed lessons reset");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to reset progress");
    }
  }

  function setSingleAnswer(questionId: string, answer: string) {
    setAnswers((current) => ({
      ...current,
      [questionId]: answer,
    }));
  }

  function toggleMultiAnswer(questionId: string, answer: string, checked: boolean) {
    setAnswers((current) => {
      const existing = current[questionId];
      const existingAnswers = Array.isArray(existing) ? existing : [];

      return {
        ...current,
        [questionId]: checked
          ? [...existingAnswers, answer]
          : existingAnswers.filter((item) => item !== answer),
      };
    });
  }

  if (isLoading || (isAuthenticated && content === undefined)) {
    return (
      <div className="mx-auto max-w-5xl">
        <PageHeading
          eyebrow="Training"
          title="Lesson"
          description="Loading lesson content."
        />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-5xl">
        <PageHeading
          eyebrow="Training"
          title="Sign in required"
          description="Sign in to view lesson content."
          actions={
            <Button asChild variant="outline">
              <Link to="/training">
                <ArrowLeft className="size-4" />
                Back to training
              </Link>
            </Button>
          }
        />
      </div>
    );
  }

  if (!content) {
    return (
      <div className="mx-auto max-w-5xl">
        <PageHeading
          eyebrow="Training"
          title="Lesson not found"
          description="This lesson is not available."
          actions={
            <Button asChild variant="outline">
              <Link to="/training">
                <ArrowLeft className="size-4" />
                Back to training
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
        eyebrow={content.track.title}
        title={content.lesson.title}
        description={content.lesson.description || content.unit.title}
        actions={
          <Button asChild variant="outline">
            <Link to="/training">
              <ArrowLeft className="size-4" />
              Back to training
            </Link>
          </Button>
        }
      />

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{lessonTypeLabel(content.lesson.lessonType)}</Badge>
              {content.lesson.required && <Badge variant="secondary">Required</Badge>}
              {isComplete && (
                <Badge>
                  <CheckCircle2 className="size-3" />
                  Complete
                </Badge>
              )}
              <Badge variant="outline">
                <Clock className="size-3" />
                {content.lesson.estimatedMinutes} min
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {embedUrl ? (
              <div className="overflow-hidden rounded-md border bg-black">
                <iframe
                  className="aspect-video w-full"
                  src={embedUrl}
                  title={content.lesson.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  referrerPolicy="strict-origin-when-cross-origin"
                />
              </div>
            ) : content.lesson.lessonType !== "exam" ? (
              <div className="rounded-md border p-4 text-sm text-muted-foreground">
                No video URL has been added for this lesson yet.
              </div>
            ) : null}

            {content.lesson.description && (
              <p className="text-sm leading-6 text-muted-foreground">
                {content.lesson.description}
              </p>
            )}

            {videoUrl && (
              <Button asChild variant="outline">
                <a href={videoUrl} target="_blank" rel="noreferrer">
                  Open video on YouTube
                </a>
              </Button>
            )}
          </CardContent>
        </Card>

        {hasQuestions && (
          <Card>
            <CardHeader>
              <CardTitle>Questions</CardTitle>
              <CardDescription>
                Complete these questions after reviewing the lesson content.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {content.questions.map((question, questionIndex) => {
                const answer = answers[question._id];
                const selectedAnswers = Array.isArray(answer) ? answer : [];

                return (
                  <div key={question._id} className="rounded-md border p-4">
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <Badge variant="outline">Question {questionIndex + 1}</Badge>
                      <Badge variant="secondary">{questionTypeLabel(question.type)}</Badge>
                      <Badge variant="outline">{question.points} pt</Badge>
                    </div>
                    <p className="font-medium">{question.prompt}</p>

                    {question.type === "multiple_choice" && (
                      <div className="mt-4 space-y-2">
                        {question.choices?.map((choice) => {
                          return (
                            <label
                              key={choice}
                              className="flex items-center gap-2 rounded-md border p-3 text-sm"
                            >
                              {question.allowMultipleCorrect ? (
                                <Checkbox
                                  checked={selectedAnswers.includes(choice)}
                                  onCheckedChange={(checked) =>
                                    toggleMultiAnswer(
                                      question._id,
                                      choice,
                                      checked === true,
                                    )
                                  }
                                />
                              ) : (
                                <input
                                  type="radio"
                                  name={`${question._id}-answer`}
                                  checked={answer === choice}
                                  onChange={() => setSingleAnswer(question._id, choice)}
                                  className="size-4 accent-primary"
                                />
                              )}
                              {choice}
                            </label>
                          );
                        })}
                      </div>
                    )}

                    {question.type === "fill_blank" && (
                      <div className="mt-4 space-y-2">
                        <Label>Answer</Label>
                        <Input placeholder="Type your answer" />
                      </div>
                    )}

                    {question.type === "short_answer" && (
                      <div className="mt-4 space-y-2">
                        <Label>Response</Label>
                        <Textarea placeholder="Write your response" />
                      </div>
                    )}

                    {question.type === "file_upload" && (
                      <div className="mt-4 rounded-md border p-4 text-sm text-muted-foreground">
                        File uploads are not enabled for students yet.
                      </div>
                    )}

                    {question.type === "true_false" && (
                      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                        <label className="flex items-center gap-2 rounded-md border p-3 text-sm">
                          <input
                            type="radio"
                            name={`${question._id}-answer`}
                            checked={answer === "true"}
                            onChange={() => setSingleAnswer(question._id, "true")}
                            className="size-4 accent-primary"
                          />
                          True
                        </label>
                        <label className="flex items-center gap-2 rounded-md border p-3 text-sm">
                          <input
                            type="radio"
                            name={`${question._id}-answer`}
                            checked={answer === "false"}
                            onChange={() => setSingleAnswer(question._id, "false")}
                            className="size-4 accent-primary"
                          />
                          False
                        </label>
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button asChild variant="outline">
              <Link to="/training">
                <ArrowLeft className="size-4" />
                Back to training
              </Link>
            </Button>
            <Button type="button" variant="ghost" onClick={handleResetProgress}>
              <RotateCcw className="size-4" />
              Reset completed lessons
            </Button>
          </div>
          <Button
            onClick={handleCompleteLesson}
            disabled={isComplete}
            variant={isComplete ? "secondary" : "default"}
          >
            <PlayCircle className="size-4" />
            {isComplete ? "Completed" : "Mark lesson complete"}
          </Button>
        </div>
      </div>
    </div>
  );
}
