import { useConvexAuth } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  Clock,
  FileQuestion,
  FileText,
  Film,
  Link2,
  ListChecks,
  Paperclip,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
  Upload,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
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

type LessonType = "video" | "video_assignment" | "exam" | "reading" | "exercise";
type QuestionType =
  | "multiple_choice"
  | "true_false"
  | "short_answer"
  | "fill_blank"
  | "file_upload";

type ChoiceForm = {
  clientId: string;
  text: string;
  isCorrect: boolean;
};

type QuestionForm = {
  clientId: string;
  id?: Id<"questions">;
  type: QuestionType;
  prompt: string;
  choices: ChoiceForm[];
  correctAnswer: string;
  allowMultipleCorrect: boolean;
  points: string;
};

type LessonForm = {
  title: string;
  description: string;
  lessonType: LessonType;
  youtubeUrl: string;
  estimatedMinutes: string;
  required: boolean;
  passingScorePercent: string;
  questions: QuestionForm[];
};

const emptyLessonForm: LessonForm = {
  title: "",
  description: "",
  lessonType: "video",
  youtubeUrl: "",
  estimatedMinutes: "15",
  required: true,
  passingScorePercent: "80",
  questions: [],
};

function createQuestion(type: QuestionType = "multiple_choice"): QuestionForm {
  return {
    clientId: crypto.randomUUID(),
    type,
    prompt: "",
    choices:
      type === "multiple_choice"
        ? [
            { clientId: crypto.randomUUID(), text: "Option A", isCorrect: true },
            { clientId: crypto.randomUUID(), text: "Option B", isCorrect: false },
          ]
        : [],
    correctAnswer: "",
    allowMultipleCorrect: false,
    points: "1",
  };
}

function parseCorrectAnswers(value: string | undefined) {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);

    if (Array.isArray(parsed)) {
      return parsed.filter((answer): answer is string => typeof answer === "string");
    }
  } catch {
    return [value];
  }

  return [value];
}

function needsQuestions(type: LessonType) {
  return type === "video_assignment" || type === "exam";
}

function needsVideo(type: LessonType) {
  return type === "video" || type === "video_assignment";
}

const lessonTypeOptions = [
  {
    value: "video" as const,
    label: "Video lesson",
    description: "Share a video and let students mark it complete.",
    icon: Film,
  },
  {
    value: "video_assignment" as const,
    label: "Assignment",
    description: "Pair a video with questions, uploads, or written work.",
    icon: ClipboardList,
  },
  {
    value: "exam" as const,
    label: "Quiz or exam",
    description: "Create a question-only assessment.",
    icon: FileQuestion,
  },
];

const questionTypeOptions = [
  {
    value: "multiple_choice" as const,
    label: "Multiple choice",
    description: "Auto-graded options",
    icon: ListChecks,
  },
  {
    value: "short_answer" as const,
    label: "Short answer",
    description: "Written response",
    icon: FileText,
  },
  {
    value: "file_upload" as const,
    label: "File upload",
    description: "Student attachment",
    icon: Upload,
  },
  {
    value: "fill_blank" as const,
    label: "Fill blank",
    description: "Exact answer",
    icon: BookOpen,
  },
  {
    value: "true_false" as const,
    label: "True / false",
    description: "Quick check",
    icon: CheckCircle2,
  },
];

function questionTypeLabel(type: QuestionType) {
  return (
    questionTypeOptions.find((option) => option.value === type)?.label ??
    type.replace("_", " ")
  );
}

function isQuestionReady(question: QuestionForm) {
  if (!question.prompt.trim()) {
    return false;
  }

  if (Number(question.points) < 1) {
    return false;
  }

  if (question.type !== "multiple_choice") {
    return true;
  }

  const choices = question.choices
    .map((choice) => choice.text.trim())
    .filter((choice) => choice.length > 0);

  return (
    choices.length >= 2 &&
    question.choices.some((choice) => choice.isCorrect && choice.text.trim())
  );
}

export function LessonEditorPage() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const navigate = useNavigate();
  const params = useParams();
  const lessonId = params.lessonId as Id<"lessons"> | undefined;
  const viewer = useQuery(api.profiles.viewer, isAuthenticated ? {} : "skip");
  const effectiveRole = useEffectiveRole(viewer?.profile.role);
  const isAdmin = effectiveRole === "admin";
  const lessonRecord = useQuery(
    api.training.getLessonForEdit,
    isAuthenticated && isAdmin && lessonId ? { lessonId } : "skip",
  );
  const saveLesson = useMutation(api.training.saveLesson);
  const [form, setForm] = useState<LessonForm>(emptyLessonForm);
  const [isSaving, setIsSaving] = useState(false);

  const trackBackHref = lessonRecord?.unit
    ? `/training/tracks/${lessonRecord.unit.trackId}/edit`
    : "/training";
  const isQuestionLesson = needsQuestions(form.lessonType);
  const totalPoints = useMemo(
    () =>
      form.questions.reduce((sum, question) => {
        const points = Number(question.points);
        return sum + (Number.isFinite(points) ? points : 0);
      }, 0),
    [form.questions],
  );
  const readyQuestionCount = useMemo(
    () => form.questions.filter((question) => isQuestionReady(question)).length,
    [form.questions],
  );

  useEffect(() => {
    if (!lessonRecord) {
      return;
    }

    // Hydrate editable form state after the lesson record loads.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm({
      title: lessonRecord.lesson.title,
      description: lessonRecord.lesson.description,
      lessonType: lessonRecord.lesson.lessonType,
      youtubeUrl: lessonRecord.lesson.youtubeUrl ?? "",
      estimatedMinutes: String(lessonRecord.lesson.estimatedMinutes),
      required: lessonRecord.lesson.required,
      passingScorePercent: String(lessonRecord.quiz?.passingScorePercent ?? 80),
      questions: lessonRecord.questions.map((question) => {
        const correctAnswers = parseCorrectAnswers(question.correctAnswer);
        const choices =
          question.type === "multiple_choice"
            ? (question.choices ?? ["Option A", "Option B"]).map((choice) => ({
                clientId: crypto.randomUUID(),
                text: choice,
                isCorrect: correctAnswers.includes(choice),
              }))
            : [];

        return {
          clientId: question._id,
          id: question._id,
          type: question.type,
          prompt: question.prompt,
          choices,
          correctAnswer: question.correctAnswer ?? "",
          allowMultipleCorrect:
            question.allowMultipleCorrect === true ||
            correctAnswers.length > 1,
          points: String(question.points),
        };
      }),
    });
  }, [lessonRecord]);

  const canSave = useMemo(() => {
    const estimatedMinutes = Number(form.estimatedMinutes);
    const passingScorePercent = Number(form.passingScorePercent);

    if (!form.title.trim()) {
      return false;
    }

    if (!Number.isFinite(estimatedMinutes) || estimatedMinutes < 1) {
      return false;
    }

    if (isQuestionLesson && form.questions.length === 0) {
      return false;
    }

    if (
      isQuestionLesson &&
      (!Number.isFinite(passingScorePercent) ||
        passingScorePercent < 0 ||
        passingScorePercent > 100 ||
        readyQuestionCount !== form.questions.length)
    ) {
      return false;
    }

    return true;
  }, [
    form.estimatedMinutes,
    form.passingScorePercent,
    form.questions.length,
    form.title,
    isQuestionLesson,
    readyQuestionCount,
  ]);

  function setLessonType(value: LessonType) {
    setForm((current) => ({
      ...current,
      lessonType: value,
      questions:
        needsQuestions(value) && current.questions.length === 0
          ? [createQuestion()]
          : current.questions,
    }));
  }

  function addQuestion(type?: QuestionType) {
    setForm((current) => ({
      ...current,
      questions: [...current.questions, createQuestion(type)],
    }));
  }

  function updateQuestion(clientId: string, patch: Partial<QuestionForm>) {
    setForm((current) => ({
      ...current,
      questions: current.questions.map((question) =>
        question.clientId === clientId ? { ...question, ...patch } : question,
      ),
    }));
  }

  function removeQuestion(clientId: string) {
    setForm((current) => ({
      ...current,
      questions: current.questions.filter((question) => question.clientId !== clientId),
    }));
  }

  function addChoice(questionClientId: string) {
    setForm((current) => ({
      ...current,
      questions: current.questions.map((question) =>
        question.clientId === questionClientId
          ? {
              ...question,
              choices: [
                ...question.choices,
                {
                  clientId: crypto.randomUUID(),
                  text: `Option ${question.choices.length + 1}`,
                  isCorrect: false,
                },
              ],
            }
          : question,
      ),
    }));
  }

  function updateChoice(
    questionClientId: string,
    choiceClientId: string,
    text: string,
  ) {
    setForm((current) => ({
      ...current,
      questions: current.questions.map((question) =>
        question.clientId === questionClientId
          ? {
              ...question,
              choices: question.choices.map((choice) =>
                choice.clientId === choiceClientId ? { ...choice, text } : choice,
              ),
            }
          : question,
      ),
    }));
  }

  function removeChoice(questionClientId: string, choiceClientId: string) {
    setForm((current) => ({
      ...current,
      questions: current.questions.map((question) =>
        question.clientId === questionClientId
          ? {
              ...question,
              choices: question.choices.filter(
                (choice) => choice.clientId !== choiceClientId,
              ),
            }
          : question,
      ),
    }));
  }

  function setChoiceCorrect(
    questionClientId: string,
    choiceClientId: string,
    isCorrect: boolean,
  ) {
    setForm((current) => ({
      ...current,
      questions: current.questions.map((question) =>
        question.clientId === questionClientId
          ? {
              ...question,
              choices: question.choices.map((choice) => {
                if (question.allowMultipleCorrect) {
                  return choice.clientId === choiceClientId
                    ? { ...choice, isCorrect }
                    : choice;
                }

                return {
                  ...choice,
                  isCorrect: choice.clientId === choiceClientId,
                };
              }),
            }
          : question,
      ),
    }));
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!lessonId) {
      return;
    }

    setIsSaving(true);

    try {
      await saveLesson({
        lessonId,
        title: form.title,
        description: form.description,
        lessonType: form.lessonType,
        youtubeUrl: form.youtubeUrl.trim() || undefined,
        estimatedMinutes: Number(form.estimatedMinutes),
        required: form.required,
        passingScorePercent: Number(form.passingScorePercent),
        questions: isQuestionLesson
          ? form.questions.map((question) => ({
              id: question.id,
              type: question.type,
              prompt: question.prompt,
              choices:
                question.type === "multiple_choice"
                  ? question.choices
                      .map((choice) => choice.text.trim())
                      .filter((choice) => choice.length > 0)
                  : undefined,
              correctAnswer:
                question.type === "multiple_choice"
                  ? JSON.stringify(
                      question.choices
                        .filter((choice) => choice.isCorrect && choice.text.trim())
                        .map((choice) => choice.text.trim()),
                    )
                  : question.correctAnswer.trim() || undefined,
              allowMultipleCorrect:
                question.type === "multiple_choice"
                  ? question.allowMultipleCorrect
                  : undefined,
              points: Number(question.points),
            }))
          : [],
      });
      toast.success("Lesson saved");
      navigate(trackBackHref);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save lesson");
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl">
        <PageHeading
          eyebrow="Learning"
          title="Edit lesson"
          description="Loading the lesson editor."
        />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-6xl">
        <PageHeading
          eyebrow="Learning"
          title="Sign in required"
          description="Sign in with an admin account to edit lessons."
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

  if (viewer === undefined || (isAdmin && lessonId && lessonRecord === undefined)) {
    return (
      <div className="mx-auto max-w-6xl">
        <PageHeading
          eyebrow="Learning"
          title="Edit lesson"
          description="Loading the lesson editor."
        />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-6xl">
        <PageHeading
          eyebrow="Learning"
          title="Admin access required"
          description="Only admins can edit lessons."
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

  if (lessonRecord === null) {
    return (
      <div className="mx-auto max-w-6xl">
        <PageHeading
          eyebrow="Learning"
          title="Lesson not found"
          description="This lesson may have been removed."
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
        eyebrow="Learning"
        title="Edit lesson"
        description="Build the lesson content, assignment prompts, and grading settings in one place."
        actions={
          <>
            <Badge variant="secondary">{lessonRecord?.unit?.title ?? "Lesson"}</Badge>
            <Button asChild variant="outline">
              <Link to={trackBackHref}>
                <ArrowLeft className="size-4" />
                Back to track
              </Link>
            </Button>
          </>
        }
      />

      <form
        onSubmit={handleSave}
        className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start"
      >
        <div className="space-y-5">
          <Card className="overflow-hidden border-primary/15 py-0">
            <CardHeader className="border-b bg-muted/35 px-5 py-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="space-y-1">
                  <CardTitle>Assignment composer</CardTitle>
                  <CardDescription>
                    Start with the student-facing title and instructions.
                  </CardDescription>
                </div>
                <Badge variant={form.required ? "default" : "outline"}>
                  {form.required ? "Required" : "Optional"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-5 px-5 py-5">
              <div className="grid gap-3 md:grid-cols-3">
                {lessonTypeOptions.map((option) => {
                  const Icon = option.icon;
                  const isSelected = form.lessonType === option.value;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setLessonType(option.value)}
                      className={`rounded-md border p-4 text-left transition hover:border-primary/60 hover:bg-accent/45 ${
                        isSelected
                          ? "border-primary bg-primary/10 shadow-sm"
                          : "bg-background"
                      }`}
                    >
                      <span className="mb-3 flex size-9 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
                        <Icon className="size-4" />
                      </span>
                      <span className="block text-sm font-semibold">
                        {option.label}
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                        {option.description}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="space-y-2">
                <Label htmlFor="lesson-title">Title</Label>
                <Input
                  id="lesson-title"
                  value={form.title}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, title: event.target.value }))
                  }
                  placeholder="Name the assignment students will see"
                  className="h-12 text-lg font-semibold"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lesson-description">Instructions</Label>
                <Textarea
                  id="lesson-description"
                  value={form.description}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  placeholder="Add the directions, expectations, links, or context students need."
                  className="min-h-32 resize-y"
                />
              </div>

              {needsVideo(form.lessonType) && (
                <div className="rounded-md border bg-background p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <Link2 className="size-4 text-primary" />
                    <Label htmlFor="lesson-youtube">Video link</Label>
                  </div>
                  <Input
                    id="lesson-youtube"
                    type="url"
                    value={form.youtubeUrl}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        youtubeUrl: event.target.value,
                      }))
                    }
                    placeholder="https://www.youtube.com/watch?v=..."
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {isQuestionLesson && (
            <Card className="overflow-hidden py-0">
              <CardHeader className="border-b bg-muted/25 px-5 py-4">
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <CardTitle>Student work</CardTitle>
                      <CardDescription>
                        Add prompts the way students will complete them.
                      </CardDescription>
                    </div>
                    <Badge variant="outline">
                      {readyQuestionCount} of {form.questions.length} ready
                    </Badge>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                    {questionTypeOptions.map((option) => {
                      const Icon = option.icon;

                      return (
                        <Button
                          key={option.value}
                          type="button"
                          variant="outline"
                          className="h-auto justify-start whitespace-normal px-3 py-2 text-left"
                          onClick={() => addQuestion(option.value)}
                        >
                          <Icon className="size-4" />
                          <span className="min-w-0">
                            <span className="block text-sm">{option.label}</span>
                            <span className="block text-xs font-normal text-muted-foreground">
                              {option.description}
                            </span>
                          </span>
                        </Button>
                      );
                    })}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 px-5 py-5">
                {form.questions.map((question, questionIndex) => (
                  <div
                    key={question.clientId}
                    className="rounded-md border bg-background p-4 shadow-sm"
                  >
                    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">Question {questionIndex + 1}</Badge>
                        <Badge variant="secondary">
                          {questionTypeLabel(question.type)}
                        </Badge>
                        {isQuestionReady(question) ? (
                          <Badge variant="outline">
                            <CheckCircle2 className="size-3" />
                            Ready
                          </Badge>
                        ) : (
                          <Badge variant="outline">Needs details</Badge>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeQuestion(question.clientId)}
                      >
                        <Trash2 className="size-4" />
                        Remove
                      </Button>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Question type</Label>
                      <Select
                        value={question.type}
                        onValueChange={(value: QuestionType) =>
                          updateQuestion(question.clientId, {
                            type: value,
                            choices:
                              value === "multiple_choice" &&
                              question.choices.length === 0
                                ? [
                                    {
                                      clientId: crypto.randomUUID(),
                                      text: "Option A",
                                      isCorrect: true,
                                    },
                                    {
                                      clientId: crypto.randomUUID(),
                                      text: "Option B",
                                      isCorrect: false,
                                    },
                                  ]
                                : question.choices,
                          })
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="multiple_choice">
                            Multiple choice
                          </SelectItem>
                          <SelectItem value="fill_blank">Fill in the blank</SelectItem>
                          <SelectItem value="file_upload">File upload</SelectItem>
                          <SelectItem value="short_answer">Short answer</SelectItem>
                          <SelectItem value="true_false">True / false</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`${question.clientId}-points`}>Points</Label>
                      <Input
                        id={`${question.clientId}-points`}
                        type="number"
                        min={1}
                        value={question.points}
                        onChange={(event) =>
                          updateQuestion(question.clientId, {
                            points: event.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor={`${question.clientId}-prompt`}>Prompt</Label>
                      <Textarea
                        id={`${question.clientId}-prompt`}
                        value={question.prompt}
                        onChange={(event) =>
                          updateQuestion(question.clientId, {
                            prompt: event.target.value,
                          })
                        }
                        placeholder="What should students answer or submit?"
                        className="min-h-24"
                        required
                      />
                    </div>
                    {question.type === "multiple_choice" && (
                      <div className="space-y-2 md:col-span-2">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <Label>Choices</Label>
                            <p className="text-sm text-muted-foreground">
                              Select the correct answer with the control on the left.
                            </p>
                          </div>
                        </div>
                        <label className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={question.allowMultipleCorrect}
                            onCheckedChange={(checked) =>
                              updateQuestion(question.clientId, {
                                allowMultipleCorrect: checked === true,
                                choices:
                                  checked === true
                                    ? question.choices
                                    : question.choices.map((choice, choiceIndex) => ({
                                        ...choice,
                                        isCorrect:
                                          choice.isCorrect &&
                                          !question.choices
                                            .slice(0, choiceIndex)
                                            .some((priorChoice) => priorChoice.isCorrect),
                                      })),
                              })
                            }
                          />
                          Allow multiple correct answers
                        </label>
                        <div className="space-y-2">
                          {question.choices.map((choice, choiceIndex) => (
                            <div
                              key={choice.clientId}
                              className="grid grid-cols-[auto_1fr_auto] items-center gap-2"
                            >
                              {question.allowMultipleCorrect ? (
                                <Checkbox
                                  checked={choice.isCorrect}
                                  onCheckedChange={(checked) =>
                                    setChoiceCorrect(
                                      question.clientId,
                                      choice.clientId,
                                      checked === true,
                                    )
                                  }
                                  aria-label={`Mark option ${choiceIndex + 1} correct`}
                                />
                              ) : (
                                <input
                                  type="radio"
                                  name={`${question.clientId}-correct-choice`}
                                  checked={choice.isCorrect}
                                  onChange={() =>
                                    setChoiceCorrect(
                                      question.clientId,
                                      choice.clientId,
                                      true,
                                    )
                                  }
                                  aria-label={`Mark option ${choiceIndex + 1} correct`}
                                  className="size-4 accent-primary"
                                />
                              )}
                              <Input
                                value={choice.text}
                                onChange={(event) =>
                                  updateChoice(
                                    question.clientId,
                                    choice.clientId,
                                    event.target.value,
                                  )
                                }
                                placeholder={`Option ${choiceIndex + 1}`}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() =>
                                  removeChoice(question.clientId, choice.clientId)
                                }
                                disabled={question.choices.length <= 2}
                                aria-label={`Remove option ${choiceIndex + 1}`}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => addChoice(question.clientId)}
                        >
                          <Plus className="size-4" />
                          Add option
                        </Button>
                      </div>
                    )}
                      {question.type !== "file_upload" &&
                        question.type !== "multiple_choice" && (
                          <div className="space-y-2 md:col-span-2">
                            <Label htmlFor={`${question.clientId}-answer`}>
                              Correct answer
                            </Label>
                            <Input
                              id={`${question.clientId}-answer`}
                              value={question.correctAnswer}
                              onChange={(event) =>
                                updateQuestion(question.clientId, {
                                  correctAnswer: event.target.value,
                                })
                              }
                              placeholder={
                                question.type === "fill_blank"
                                  ? "Expected blank text"
                                  : "Answer key"
                              }
                            />
                          </div>
                        )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20">
          <Card className="py-0">
            <CardHeader className="border-b px-5 py-4">
              <CardTitle>Settings</CardTitle>
              <CardDescription>Save-ready controls stay here.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 px-5 py-5">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                <div className="space-y-2">
                  <Label htmlFor="lesson-minutes" className="flex items-center gap-2">
                    <Clock className="size-4 text-primary" />
                    Estimated minutes
                  </Label>
                  <Input
                    id="lesson-minutes"
                    type="number"
                    min={1}
                    value={form.estimatedMinutes}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        estimatedMinutes: event.target.value,
                      }))
                    }
                    required
                  />
                </div>

                {isQuestionLesson && (
                  <div className="space-y-2">
                    <Label htmlFor="passing-score" className="flex items-center gap-2">
                      <ShieldCheck className="size-4 text-primary" />
                      Passing score
                    </Label>
                    <Input
                      id="passing-score"
                      type="number"
                      min={0}
                      max={100}
                      value={form.passingScorePercent}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          passingScorePercent: event.target.value,
                        }))
                      }
                    />
                  </div>
                )}
              </div>

              <label className="flex items-start gap-3 rounded-md border bg-muted/25 p-3 text-sm">
                <Checkbox
                  checked={form.required}
                  onCheckedChange={(checked) =>
                    setForm((current) => ({
                      ...current,
                      required: checked === true,
                    }))
                  }
                  className="mt-0.5"
                />
                <span>
                  <span className="block font-medium">Required lesson</span>
                  <span className="block text-muted-foreground">
                    Count this work toward track completion.
                  </span>
                </span>
              </label>

              <div className="space-y-3 rounded-md border bg-background p-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Format</span>
                  <span className="font-medium">
                    {
                      lessonTypeOptions.find(
                        (option) => option.value === form.lessonType,
                      )?.label
                    }
                  </span>
                </div>
                {isQuestionLesson && (
                  <>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Questions</span>
                      <span className="font-medium">
                        {readyQuestionCount}/{form.questions.length} ready
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Points</span>
                      <span className="font-medium">{totalPoints}</span>
                    </div>
                  </>
                )}
                {needsVideo(form.lessonType) && (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Video</span>
                    <span className="font-medium">
                      {form.youtubeUrl.trim() ? "Linked" : "Not added"}
                    </span>
                  </div>
                )}
              </div>

              {!canSave && (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  Add the missing title, prompt details, or grading values before saving.
                </div>
              )}

              <div className="grid gap-2">
                <Button type="submit" disabled={isSaving || !canSave}>
                  <Save className="size-4" />
                  {isSaving ? "Saving..." : "Save and return"}
                </Button>
                <Button asChild type="button" variant="outline">
                  <Link to={trackBackHref}>
                    <ArrowLeft className="size-4" />
                    Back to track
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          {isQuestionLesson && (
            <Card className="py-0">
              <CardContent className="space-y-3 px-5 py-5">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Paperclip className="size-4 text-primary" />
                  Assignment feel
                </div>
                <p className="text-sm leading-6 text-muted-foreground">
                  Students see the instructions, video, and questions together when
                  they open this lesson.
                </p>
              </CardContent>
            </Card>
          )}
        </aside>
      </form>
    </div>
  );
}
