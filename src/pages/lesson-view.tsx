import { useConvexAuth } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  PlayCircle,
  Send,
  Upload,
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
import { useEffectiveRole } from "@/providers/role-preview-provider";
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
  const viewer = useQuery(api.profiles.viewer, isAuthenticated ? {} : "skip");
  const content = useQuery(
    api.training.getLessonForStudent,
    isAuthenticated && lessonId ? { lessonId } : "skip",
  );
  const progress = useQuery(api.demo.myLessonProgress, isAuthenticated ? {} : "skip");
  const markDemoLessonComplete = useMutation(api.demo.markDemoLessonComplete);
  const generateLessonUploadUrl = useMutation(api.training.generateLessonUploadUrl);
  const submitLessonQuiz = useMutation(api.training.submitLessonQuiz);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [uploadedFiles, setUploadedFiles] = useState<Record<string, string>>({});
  const [uploadingQuestionId, setUploadingQuestionId] = useState<string | null>(null);
  const [isSubmittingQuestions, setIsSubmittingQuestions] = useState(false);
  const effectiveRole = useEffectiveRole(viewer?.profile.role);
  const isAdmin = effectiveRole === "admin";
  const visibleContent =
    content && (isAdmin || content.track.isPublished) ? content : null;

  const isComplete = progress?.some((item) => item.lessonId === lessonId) ?? false;
  const embedUrl = youtubeEmbedUrl(visibleContent?.lesson.youtubeUrl);
  const videoUrl = externalVideoUrl(visibleContent?.lesson.youtubeUrl);
  const hasQuestions = Boolean(visibleContent && visibleContent.questions.length > 0);
  const hasPassedQuestions = visibleContent?.latestQuizAttempt?.status === "passed";
  const isPlainVideoLesson =
    visibleContent?.lesson.lessonType === "video" && !hasQuestions;

  async function handleCompleteLesson() {
    if (!lessonId) {
      return;
    }

    if (!isPlainVideoLesson) {
      toast.error("This lesson must be completed through its assigned activity.");
      return;
    }

    try {
      await markDemoLessonComplete({ lessonId });
      toast.success("Lesson marked complete");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update progress");
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

  async function handleFileUpload(questionId: string, file: File | undefined) {
    if (!file) {
      return;
    }

    setUploadingQuestionId(questionId);

    try {
      const uploadUrl = await generateLessonUploadUrl({});
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });

      if (!response.ok) {
        throw new Error(`Unable to upload ${file.name}.`);
      }

      const { storageId } = (await response.json()) as { storageId: Id<"_storage"> };
      setSingleAnswer(questionId, JSON.stringify({ fileName: file.name, storageId }));
      setUploadedFiles((current) => ({
        ...current,
        [questionId]: file.name,
      }));
      toast.success(`${file.name} uploaded`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to upload file");
    } finally {
      setUploadingQuestionId(null);
    }
  }

  async function handleSubmitQuestions() {
    if (!lessonId || !visibleContent) {
      return;
    }

    const submittedAnswers = visibleContent.questions.map((question) => {
      const answer = answers[question._id];
      const normalizedAnswer = Array.isArray(answer)
        ? JSON.stringify(answer)
        : (answer ?? "").trim();

      return {
        questionId: question._id,
        answer: normalizedAnswer,
      };
    });
    const missingAnswer = submittedAnswers.some((answer) => !answer.answer);

    if (missingAnswer) {
      toast.error("Answer every question before submitting.");
      return;
    }

    setIsSubmittingQuestions(true);

    try {
      const result = await submitLessonQuiz({
        lessonId,
        answers: submittedAnswers,
      });

      if (result.status === "submitted") {
        toast.success("Submission sent for review");
      } else if (result.status === "passed") {
        toast.success(`Questions passed with ${result.scorePercent}%`);
      } else {
        toast.error(`Questions not passed. Score: ${result.scorePercent}%`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to submit questions");
    } finally {
      setIsSubmittingQuestions(false);
    }
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

  if (!visibleContent) {
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
        eyebrow={visibleContent.track.title}
        title={visibleContent.lesson.title}
        description={visibleContent.lesson.description || visibleContent.unit.title}
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
              <Badge variant="outline">{lessonTypeLabel(visibleContent.lesson.lessonType)}</Badge>
              {visibleContent.lesson.required && <Badge variant="secondary">Required</Badge>}
              {isComplete && (
                <Badge>
                  <CheckCircle2 className="size-3" />
                  Complete
                </Badge>
              )}
              <Badge variant="outline">
                <Clock className="size-3" />
                {visibleContent.lesson.estimatedMinutes} min
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {embedUrl ? (
              <div className="overflow-hidden rounded-md border bg-black">
                <iframe
                  className="aspect-video w-full"
                  src={embedUrl}
                  title={visibleContent.lesson.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  referrerPolicy="strict-origin-when-cross-origin"
                />
              </div>
            ) : visibleContent.lesson.lessonType !== "exam" ? (
              <div className="rounded-md border p-4 text-sm text-muted-foreground">
                No video URL has been added for this lesson yet.
              </div>
            ) : null}

            {visibleContent.lesson.description && (
              <p className="text-sm leading-6 text-muted-foreground">
                {visibleContent.lesson.description}
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
                Complete and pass these questions before the lesson can be marked complete.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {visibleContent.latestQuizAttempt && (
                <div className="rounded-md border p-4 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant={
                        visibleContent.latestQuizAttempt.status === "passed"
                          ? "default"
                          : "outline"
                      }
                    >
                      {visibleContent.latestQuizAttempt.status}
                      {visibleContent.latestQuizAttempt.scorePercent === undefined
                        ? ""
                        : ` ${visibleContent.latestQuizAttempt.scorePercent}%`}
                    </Badge>
                    {hasPassedQuestions && (
                      <span className="text-muted-foreground">
                        This lesson was marked complete after passing.
                      </span>
                    )}
                  </div>
                </div>
              )}
              {visibleContent.questions.map((question, questionIndex) => {
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
                        <Input
                          placeholder="Type your answer"
                          value={typeof answer === "string" ? answer : ""}
                          onChange={(event) =>
                            setSingleAnswer(question._id, event.target.value)
                          }
                        />
                      </div>
                    )}

                    {question.type === "short_answer" && (
                      <div className="mt-4 space-y-2">
                        <Label>Response</Label>
                        <Textarea
                          placeholder="Write your response"
                          value={typeof answer === "string" ? answer : ""}
                          onChange={(event) =>
                            setSingleAnswer(question._id, event.target.value)
                          }
                        />
                      </div>
                    )}

                    {question.type === "file_upload" && (
                      <div className="mt-4 space-y-3 rounded-md border p-4 text-sm">
                        <div className="space-y-1">
                          <Label htmlFor={`${question._id}-file`}>Upload file</Label>
                          <Input
                            id={`${question._id}-file`}
                            type="file"
                            disabled={uploadingQuestionId === question._id}
                            onChange={(event) =>
                              void handleFileUpload(
                                question._id,
                                event.currentTarget.files?.[0],
                              )
                            }
                          />
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Upload className="size-4" />
                          {uploadingQuestionId === question._id
                            ? "Uploading..."
                            : uploadedFiles[question._id]
                              ? `Ready to submit: ${uploadedFiles[question._id]}`
                              : "Choose a file, then submit your answers."}
                        </div>
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
              <div className="flex justify-end">
                <Button
                  type="button"
                  onClick={handleSubmitQuestions}
                  disabled={isSubmittingQuestions || hasPassedQuestions}
                >
                  <Send className="size-4" />
                  {hasPassedQuestions
                    ? "Questions passed"
                    : isSubmittingQuestions
                      ? "Submitting..."
                      : "Submit answers"}
                </Button>
              </div>
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
          </div>
          <Button
            onClick={handleCompleteLesson}
            disabled={isComplete || !isPlainVideoLesson}
            variant={isComplete ? "secondary" : "default"}
          >
            <PlayCircle className="size-4" />
            {isComplete
              ? "Completed"
              : isPlainVideoLesson
                ? "Mark lesson complete"
                : "Complete activity to finish"}
          </Button>
        </div>
      </div>
    </div>
  );
}
