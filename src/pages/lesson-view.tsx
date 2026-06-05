import { useConvexAuth } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  Clock,
  ExternalLink,
  FileQuestion,
  Film,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

  if (type === "paragraph") {
    return "Paragraph";
  }

  if (type === "fill_blank") {
    return "Fill in the blank";
  }

  if (type === "file_upload") {
    return "File upload";
  }

  if (type === "number") {
    return "Number";
  }

  if (type === "linear_scale") {
    return "Linear scale";
  }

  if (type === "matching") {
    return "Matching";
  }

  if (type === "ordering") {
    return "Ordering";
  }

  if (type === "url") {
    return "URL";
  }

  if (type === "true_false") {
    return "True / false";
  }

  return "Short answer";
}

function lessonTypeLabel(type: string) {
  if (type === "video_assignment") {
    return "Assignment";
  }

  if (type === "exam") {
    return "Quiz or exam";
  }

  if (type === "reading") {
    return "Material";
  }

  if (type === "exercise") {
    return "Practice";
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

  if (type === "reading") {
    return <BookOpen className={className} />;
  }

  if (type === "exercise") {
    return <CheckCircle2 className={className} />;
  }

  return <Film className={className} />;
}

function parseAnswerArray(answer: string | string[] | undefined) {
  if (Array.isArray(answer)) {
    return answer;
  }

  if (!answer) {
    return [];
  }

  try {
    const parsed = JSON.parse(answer);

    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === "string");
    }
  } catch {
    return [];
  }

  return [];
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
  const isSelfCompleteLesson =
    (visibleContent?.lesson.lessonType === "video" ||
      visibleContent?.lesson.lessonType === "reading") &&
    !hasQuestions;
  const totalPoints =
    visibleContent?.questions.reduce((sum, question) => sum + question.points, 0) ?? 0;

  async function handleCompleteLesson() {
    if (!lessonId) {
      return;
    }

    if (!isSelfCompleteLesson) {
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

  function setArrayAnswer(questionId: string, answerIndex: number, answer: string) {
    setAnswers((current) => {
      const nextAnswers = parseAnswerArray(current[questionId]);
      nextAnswers[answerIndex] = answer;

      return {
        ...current,
        [questionId]: nextAnswers,
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
      const expectedArrayAnswerCount =
        question.type === "matching"
          ? question.matchingPairs?.length ?? 0
          : question.type === "ordering"
            ? question.choices?.length ?? 0
            : 0;
      const hasMissingArrayAnswer =
        Array.isArray(answer) &&
        expectedArrayAnswerCount > 0 &&
        (answer.length !== expectedArrayAnswerCount ||
          answer.some((item) => !item));
      const normalizedAnswer = Array.isArray(answer)
        ? JSON.stringify(answer)
        : (answer ?? "").trim();

      return {
        questionId: question._id,
        answer: normalizedAnswer,
        hasMissingArrayAnswer,
      };
    });
    const missingAnswer = submittedAnswers.some(
      (answer) => !answer.answer || answer.hasMissingArrayAnswer,
    );

    if (missingAnswer) {
      toast.error("Answer every question before submitting.");
      return;
    }

    setIsSubmittingQuestions(true);

    try {
      const result = await submitLessonQuiz({
        lessonId,
        answers: submittedAnswers.map(({ questionId, answer }) => ({
          questionId,
          answer,
        })),
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
          eyebrow="Learning"
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
          eyebrow="Learning"
          title="Sign in required"
          description="Sign in to view lesson content."
          actions={
            <Button asChild variant="outline">
              <Link to="/training">
                <ArrowLeft className="size-4" />
                Back to learning
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
          eyebrow="Learning"
          title="Lesson not found"
          description="This lesson is not available."
          actions={
            <Button asChild variant="outline">
              <Link to="/training">
                <ArrowLeft className="size-4" />
                Back to learning
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
        eyebrow={visibleContent.track.title}
        title={visibleContent.lesson.title}
        description={visibleContent.lesson.description || visibleContent.unit.title}
        actions={
          <Button asChild variant="outline">
            <Link to="/training">
              <ArrowLeft className="size-4" />
              Back to learning
            </Link>
          </Button>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div className="space-y-5">
          <Card className="overflow-hidden py-0">
            <CardHeader className="border-b bg-muted/25 px-5 py-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">
                      {lessonTypeLabel(visibleContent.lesson.lessonType)}
                    </Badge>
                    {visibleContent.lesson.required && (
                      <Badge variant="secondary">Required</Badge>
                    )}
                    {isComplete && (
                      <Badge>
                        <CheckCircle2 className="size-3" />
                        Complete
                      </Badge>
                    )}
                  </div>
                  <CardTitle>Lesson content</CardTitle>
                  <CardDescription>{visibleContent.unit.title}</CardDescription>
                </div>
                <Badge variant="outline">
                  <Clock className="size-3" />
                  {visibleContent.lesson.estimatedMinutes} min
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 px-5 py-5">
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
                <div className="rounded-md border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
                  No video URL has been added for this lesson yet.
                </div>
              ) : null}

              {visibleContent.lesson.description && (
                <div className="rounded-md border bg-background p-4">
                  <h2 className="mb-2 font-medium">Instructions</h2>
                  <p className="text-sm leading-6 text-muted-foreground">
                    {visibleContent.lesson.description}
                  </p>
                </div>
              )}

              {visibleContent.resources.length > 0 && (
                <div className="rounded-md border bg-background p-4">
                  <h2 className="mb-3 font-medium">Materials</h2>
                  <div className="space-y-2">
                    {visibleContent.resources.map((resource) => (
                      <div
                        key={resource._id}
                        className="flex flex-col gap-2 rounded-md border bg-card p-3 sm:flex-row sm:items-start sm:justify-between"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline">
                              {resource.resourceType === "file"
                                ? "File"
                                : resource.resourceType === "note"
                                  ? "Note"
                                  : "Link"}
                            </Badge>
                            <p className="font-medium">{resource.title}</p>
                          </div>
                          {resource.notes && (
                            <p className="mt-1 text-sm leading-6 text-muted-foreground">
                              {resource.notes}
                            </p>
                          )}
                        </div>
                        {resource.url && (
                          <Button asChild variant="outline" size="sm">
                            <a href={resource.url} target="_blank" rel="noreferrer">
                              <ExternalLink className="size-4" />
                              Open
                            </a>
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {videoUrl && (
                <Button asChild variant="outline">
                  <a href={videoUrl} target="_blank" rel="noreferrer">
                    <ExternalLink className="size-4" />
                    Open video on YouTube
                  </a>
                </Button>
              )}
            </CardContent>
          </Card>

          {hasQuestions && (
            <Card className="overflow-hidden py-0">
              <CardHeader className="border-b bg-muted/25 px-5 py-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <CardTitle>Student work</CardTitle>
                    <CardDescription>
                      Complete the questions and submit your answers.
                    </CardDescription>
                  </div>
                  <Badge variant="outline">{totalPoints} pts</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 px-5 py-5">
              {visibleContent.latestQuizAttempt && (
                <div className="rounded-md border bg-background p-4 text-sm">
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
                const arrayAnswers = parseAnswerArray(answer);
                const scaleMin = question.scaleMin ?? 1;
                const scaleMax = question.scaleMax ?? 5;

                return (
                  <div key={question._id} className="rounded-md border bg-background p-4 shadow-sm">
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
                              className="flex items-center gap-2 rounded-md border bg-card p-3 text-sm transition-colors hover:bg-accent/50"
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
                          placeholder={question.answerPlaceholder ?? "Write your response"}
                          value={typeof answer === "string" ? answer : ""}
                          onChange={(event) =>
                            setSingleAnswer(question._id, event.target.value)
                          }
                        />
                      </div>
                    )}

                    {question.type === "paragraph" && (
                      <div className="mt-4 space-y-2">
                        <Label>Response</Label>
                        <Textarea
                          placeholder={
                            question.answerPlaceholder ?? "Write your response"
                          }
                          value={typeof answer === "string" ? answer : ""}
                          onChange={(event) =>
                            setSingleAnswer(question._id, event.target.value)
                          }
                          className="min-h-32"
                        />
                      </div>
                    )}

                    {question.type === "number" && (
                      <div className="mt-4 space-y-2">
                        <Label>Number</Label>
                        <Input
                          type="number"
                          placeholder="Enter a number"
                          value={typeof answer === "string" ? answer : ""}
                          onChange={(event) =>
                            setSingleAnswer(question._id, event.target.value)
                          }
                        />
                      </div>
                    )}

                    {question.type === "url" && (
                      <div className="mt-4 space-y-2">
                        <Label>URL</Label>
                        <Input
                          type="url"
                          placeholder={question.answerPlaceholder ?? "https://..."}
                          value={typeof answer === "string" ? answer : ""}
                          onChange={(event) =>
                            setSingleAnswer(question._id, event.target.value)
                          }
                        />
                      </div>
                    )}

                    {question.type === "linear_scale" && (
                      <div className="mt-4 space-y-3">
                        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                          <span>{question.scaleMinLabel}</span>
                          <span>{question.scaleMaxLabel}</span>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-5">
                          {Array.from(
                            { length: Math.max(0, scaleMax - scaleMin + 1) },
                            (_, index) => scaleMin + index,
                          ).map((scaleValue) => (
                            <label
                              key={scaleValue}
                              className="flex items-center justify-center gap-2 rounded-md border bg-card p-3 text-sm transition-colors hover:bg-accent/50"
                            >
                              <input
                                type="radio"
                                name={`${question._id}-scale-answer`}
                                checked={answer === String(scaleValue)}
                                onChange={() =>
                                  setSingleAnswer(question._id, String(scaleValue))
                                }
                                className="size-4 accent-primary"
                              />
                              {scaleValue}
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                    {question.type === "matching" && (
                      <div className="mt-4 space-y-3">
                        {question.matchingPairs?.map((pair, pairIndex) => {
                          const selectedPairAnswer =
                            arrayAnswers[pairIndex]?.split("::")[1] ?? "";

                          return (
                            <div
                              key={`${question._id}-${pair.prompt}`}
                              className="grid gap-2 rounded-md border bg-card p-3 sm:grid-cols-[1fr_220px]"
                            >
                              <p className="text-sm font-medium">{pair.prompt}</p>
                              <Select
                                value={selectedPairAnswer}
                                onValueChange={(value) =>
                                  setArrayAnswer(
                                    question._id,
                                    pairIndex,
                                    `${pair.prompt}::${value}`,
                                  )
                                }
                              >
                                <SelectTrigger className="w-full bg-background">
                                  <SelectValue placeholder="Choose match" />
                                </SelectTrigger>
                                <SelectContent>
                                  {question.matchingPairs?.map((option) => (
                                    <SelectItem
                                      key={`${pair.prompt}-${option.answer}`}
                                      value={option.answer}
                                    >
                                      {option.answer}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {question.type === "ordering" && (
                      <div className="mt-4 space-y-3">
                        {question.choices?.map((_, orderIndex) => (
                          <div
                            key={`${question._id}-order-${orderIndex}`}
                            className="grid gap-2 rounded-md border bg-card p-3 sm:grid-cols-[80px_1fr]"
                          >
                            <Badge variant="outline">#{orderIndex + 1}</Badge>
                            <Select
                              value={arrayAnswers[orderIndex] ?? ""}
                              onValueChange={(value) =>
                                setArrayAnswer(question._id, orderIndex, value)
                              }
                            >
                              <SelectTrigger className="w-full bg-background">
                                <SelectValue placeholder="Choose item" />
                              </SelectTrigger>
                              <SelectContent>
                                {question.choices?.map((choice) => (
                                  <SelectItem key={choice} value={choice}>
                                    {choice}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        ))}
                      </div>
                    )}

                    {question.type === "file_upload" && (
                      <div className="mt-4 space-y-3 rounded-md border bg-card p-4 text-sm">
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
                        <label className="flex items-center gap-2 rounded-md border bg-card p-3 text-sm">
                          <input
                            type="radio"
                            name={`${question._id}-answer`}
                            checked={answer === "true"}
                            onChange={() => setSingleAnswer(question._id, "true")}
                            className="size-4 accent-primary"
                          />
                          True
                        </label>
                        <label className="flex items-center gap-2 rounded-md border bg-card p-3 text-sm">
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
                    className="w-full sm:w-auto"
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
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20">
          <Card className="py-0">
            <CardHeader className="border-b px-5 py-4">
              <CardTitle>Lesson status</CardTitle>
              <CardDescription>Progress and completion actions.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 px-5 py-5">
              <div className="flex items-center gap-3 rounded-md border bg-muted/25 p-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
                  <LessonTypeIcon type={visibleContent.lesson.lessonType} />
                </span>
                <div>
                  <p className="text-sm font-medium">
                    {lessonTypeLabel(visibleContent.lesson.lessonType)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {visibleContent.lesson.required ? "Required lesson" : "Optional lesson"}
                  </p>
                </div>
              </div>

              <div className="space-y-3 rounded-md border p-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Status</span>
                  <span className="font-medium">{isComplete ? "Complete" : "In progress"}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Questions</span>
                  <span className="font-medium">{visibleContent.questions.length}</span>
                </div>
                {hasQuestions && (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Points</span>
                    <span className="font-medium">{totalPoints}</span>
                  </div>
                )}
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Time</span>
                  <span className="font-medium">
                    {visibleContent.lesson.estimatedMinutes} min
                  </span>
                </div>
              </div>

              <Button
                onClick={handleCompleteLesson}
                disabled={isComplete || !isSelfCompleteLesson}
                variant={isComplete ? "secondary" : "default"}
                className="w-full"
              >
                <PlayCircle className="size-4" />
                {isComplete
                  ? "Completed"
                  : isSelfCompleteLesson
                    ? "Mark lesson complete"
                    : "Complete activity to finish"}
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link to={`/training/tracks/${visibleContent.track._id}`}>
                  <ArrowLeft className="size-4" />
                  Back to track
                </Link>
              </Button>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
