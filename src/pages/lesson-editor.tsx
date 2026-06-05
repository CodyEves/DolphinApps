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
  GripVertical,
  Link2,
  ListChecks,
  Paperclip,
  Plus,
  Save,
  SlidersHorizontal,
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
  | "paragraph"
  | "fill_blank"
  | "file_upload"
  | "number"
  | "linear_scale"
  | "matching"
  | "ordering"
  | "url";
type ResourceType = "link" | "file" | "note";

type ChoiceForm = {
  clientId: string;
  text: string;
  isCorrect: boolean;
};

type MatchingPairForm = {
  clientId: string;
  prompt: string;
  answer: string;
};

type ResourceForm = {
  clientId: string;
  id?: Id<"lessonResources">;
  resourceType: ResourceType;
  title: string;
  url: string;
  notes: string;
};

type QuestionForm = {
  clientId: string;
  id?: Id<"questions">;
  type: QuestionType;
  prompt: string;
  choices: ChoiceForm[];
  matchingPairs: MatchingPairForm[];
  correctAnswer: string;
  allowMultipleCorrect: boolean;
  points: string;
  scaleMin: string;
  scaleMax: string;
  scaleMinLabel: string;
  scaleMaxLabel: string;
  answerPlaceholder: string;
};

type LessonForm = {
  title: string;
  description: string;
  lessonType: LessonType;
  youtubeUrl: string;
  estimatedMinutes: string;
  required: boolean;
  passingScorePercent: string;
  resources: ResourceForm[];
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
  resources: [],
  questions: [],
};

function createChoice(text: string, isCorrect = false): ChoiceForm {
  return {
    clientId: crypto.randomUUID(),
    text,
    isCorrect,
  };
}

function createMatchingPair(index: number): MatchingPairForm {
  return {
    clientId: crypto.randomUUID(),
    prompt: `Item ${index}`,
    answer: `Match ${index}`,
  };
}

function createQuestion(type: QuestionType = "multiple_choice"): QuestionForm {
  return {
    clientId: crypto.randomUUID(),
    type,
    prompt: "",
    choices:
      type === "multiple_choice" || type === "ordering"
        ? [createChoice("Option A", true), createChoice("Option B")]
        : [],
    matchingPairs:
      type === "matching" ? [createMatchingPair(1), createMatchingPair(2)] : [],
    correctAnswer: type === "true_false" ? "true" : "",
    allowMultipleCorrect: false,
    points: "1",
    scaleMin: "1",
    scaleMax: "5",
    scaleMinLabel: "Low",
    scaleMaxLabel: "High",
    answerPlaceholder: "",
  };
}

function createResource(resourceType: ResourceType = "link"): ResourceForm {
  return {
    clientId: crypto.randomUUID(),
    resourceType,
    title: "",
    url: "",
    notes: "",
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

function needsVideo(type: LessonType) {
  return type === "video" || type === "video_assignment";
}

function requiresStudentWork(type: LessonType) {
  return type === "video_assignment" || type === "exam" || type === "exercise";
}

const lessonTypeOptions = [
  {
    value: "video" as const,
    label: "Video",
    description: "Watch-and-complete lesson",
    icon: Film,
  },
  {
    value: "reading" as const,
    label: "Material",
    description: "Reading, links, and references",
    icon: BookOpen,
  },
  {
    value: "video_assignment" as const,
    label: "Assignment",
    description: "Instructions plus student work",
    icon: ClipboardList,
  },
  {
    value: "exam" as const,
    label: "Quiz",
    description: "Questions only",
    icon: FileQuestion,
  },
  {
    value: "exercise" as const,
    label: "Practice",
    description: "Hands-on or written activity",
    icon: CheckCircle2,
  },
];

const questionTypeOptions = [
  {
    value: "multiple_choice" as const,
    label: "Multiple choice",
    description: "One or many correct choices",
    icon: ListChecks,
  },
  {
    value: "true_false" as const,
    label: "True / false",
    description: "Two-option check",
    icon: CheckCircle2,
  },
  {
    value: "short_answer" as const,
    label: "Short answer",
    description: "Optional answer key",
    icon: FileText,
  },
  {
    value: "paragraph" as const,
    label: "Paragraph",
    description: "Manual review response",
    icon: FileText,
  },
  {
    value: "fill_blank" as const,
    label: "Fill blank",
    description: "Exact text answer",
    icon: BookOpen,
  },
  {
    value: "number" as const,
    label: "Number",
    description: "Numeric answer",
    icon: SlidersHorizontal,
  },
  {
    value: "linear_scale" as const,
    label: "Linear scale",
    description: "Range selection",
    icon: SlidersHorizontal,
  },
  {
    value: "matching" as const,
    label: "Matching",
    description: "Pair terms and answers",
    icon: GripVertical,
  },
  {
    value: "ordering" as const,
    label: "Ordering",
    description: "Put items in sequence",
    icon: GripVertical,
  },
  {
    value: "file_upload" as const,
    label: "File upload",
    description: "Student attachment",
    icon: Upload,
  },
  {
    value: "url" as const,
    label: "URL",
    description: "Link submission",
    icon: Link2,
  },
];

function questionTypeLabel(type: QuestionType) {
  return (
    questionTypeOptions.find((option) => option.value === type)?.label ??
    type.replace("_", " ")
  );
}

function isQuestionReady(question: QuestionForm) {
  if (!question.prompt.trim() || Number(question.points) < 1) {
    return false;
  }

  if (question.type === "multiple_choice") {
    const choices = question.choices.filter((choice) => choice.text.trim());

    return (
      choices.length >= 2 &&
      question.choices.some((choice) => choice.isCorrect && choice.text.trim())
    );
  }

  if (question.type === "matching") {
    return (
      question.matchingPairs.filter(
        (pair) => pair.prompt.trim() && pair.answer.trim(),
      ).length >= 2
    );
  }

  if (question.type === "ordering") {
    return question.choices.filter((choice) => choice.text.trim()).length >= 2;
  }

  if (question.type === "linear_scale") {
    const min = Number(question.scaleMin);
    const max = Number(question.scaleMax);
    const answer = Number(question.correctAnswer);

    return (
      Number.isFinite(min) &&
      Number.isFinite(max) &&
      max > min &&
      Number.isFinite(answer) &&
      answer >= min &&
      answer <= max
    );
  }

  if (
    question.type === "true_false" ||
    question.type === "fill_blank" ||
    question.type === "number"
  ) {
    return Boolean(question.correctAnswer.trim());
  }

  return true;
}

function selectedLessonTypeLabel(type: LessonType) {
  return lessonTypeOptions.find((option) => option.value === type)?.label ?? "Lesson";
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
  const requiresWork = requiresStudentWork(form.lessonType);
  const hasStudentWork = form.questions.length > 0;
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
  const readyResourceCount = useMemo(
    () =>
      form.resources.filter((resource) => {
        if (!resource.title.trim()) {
          return false;
        }

        return resource.resourceType === "note" || Boolean(resource.url.trim());
      }).length,
    [form.resources],
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
      resources: (lessonRecord.resources ?? []).map((resource) => ({
        clientId: resource._id,
        id: resource._id,
        resourceType: resource.resourceType,
        title: resource.title,
        url: resource.url ?? "",
        notes: resource.notes ?? "",
      })),
      questions: lessonRecord.questions.map((question) => {
        const correctAnswers = parseCorrectAnswers(question.correctAnswer);
        const choices =
          question.type === "multiple_choice" || question.type === "ordering"
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
          matchingPairs: (question.matchingPairs ?? []).map((pair) => ({
            clientId: crypto.randomUUID(),
            prompt: pair.prompt,
            answer: pair.answer,
          })),
          correctAnswer: question.correctAnswer ?? "",
          allowMultipleCorrect:
            question.allowMultipleCorrect === true || correctAnswers.length > 1,
          points: String(question.points),
          scaleMin: String(question.scaleMin ?? 1),
          scaleMax: String(question.scaleMax ?? 5),
          scaleMinLabel: question.scaleMinLabel ?? "Low",
          scaleMaxLabel: question.scaleMaxLabel ?? "High",
          answerPlaceholder: question.answerPlaceholder ?? "",
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

    if (form.resources.length !== readyResourceCount) {
      return false;
    }

    if (requiresWork && form.questions.length === 0) {
      return false;
    }

    if (
      hasStudentWork &&
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
    form.resources.length,
    form.title,
    hasStudentWork,
    readyQuestionCount,
    readyResourceCount,
    requiresWork,
  ]);

  function setLessonType(value: LessonType) {
    setForm((current) => ({
      ...current,
      lessonType: value,
      questions:
        requiresStudentWork(value) && current.questions.length === 0
          ? [createQuestion(value === "exam" ? "multiple_choice" : "file_upload")]
          : current.questions,
    }));
  }

  function addResource(resourceType: ResourceType = "link") {
    setForm((current) => ({
      ...current,
      resources: [...current.resources, createResource(resourceType)],
    }));
  }

  function updateResource(clientId: string, patch: Partial<ResourceForm>) {
    setForm((current) => ({
      ...current,
      resources: current.resources.map((resource) =>
        resource.clientId === clientId ? { ...resource, ...patch } : resource,
      ),
    }));
  }

  function removeResource(clientId: string) {
    setForm((current) => ({
      ...current,
      resources: current.resources.filter((resource) => resource.clientId !== clientId),
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

  function changeQuestionType(question: QuestionForm, type: QuestionType) {
    const template = createQuestion(type);

    updateQuestion(question.clientId, {
      type,
      choices: template.choices.length > 0 ? template.choices : question.choices,
      matchingPairs:
        template.matchingPairs.length > 0
          ? template.matchingPairs
          : question.matchingPairs,
      correctAnswer: type === "true_false" ? "true" : "",
      scaleMin: template.scaleMin,
      scaleMax: template.scaleMax,
      scaleMinLabel: template.scaleMinLabel,
      scaleMaxLabel: template.scaleMaxLabel,
    });
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
                createChoice(`Option ${question.choices.length + 1}`),
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

  function addMatchingPair(questionClientId: string) {
    setForm((current) => ({
      ...current,
      questions: current.questions.map((question) =>
        question.clientId === questionClientId
          ? {
              ...question,
              matchingPairs: [
                ...question.matchingPairs,
                createMatchingPair(question.matchingPairs.length + 1),
              ],
            }
          : question,
      ),
    }));
  }

  function updateMatchingPair(
    questionClientId: string,
    pairClientId: string,
    patch: Partial<MatchingPairForm>,
  ) {
    setForm((current) => ({
      ...current,
      questions: current.questions.map((question) =>
        question.clientId === questionClientId
          ? {
              ...question,
              matchingPairs: question.matchingPairs.map((pair) =>
                pair.clientId === pairClientId ? { ...pair, ...patch } : pair,
              ),
            }
          : question,
      ),
    }));
  }

  function removeMatchingPair(questionClientId: string, pairClientId: string) {
    setForm((current) => ({
      ...current,
      questions: current.questions.map((question) =>
        question.clientId === questionClientId
          ? {
              ...question,
              matchingPairs: question.matchingPairs.filter(
                (pair) => pair.clientId !== pairClientId,
              ),
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
        resources: form.resources.map((resource) => ({
          ...(resource.id ? { id: resource.id } : {}),
          resourceType: resource.resourceType,
          title: resource.title,
          ...(resource.url.trim() ? { url: resource.url.trim() } : {}),
          ...(resource.notes.trim() ? { notes: resource.notes.trim() } : {}),
        })),
        questions: hasStudentWork
          ? form.questions.map((question) => {
              const choices = question.choices
                .map((choice) => choice.text.trim())
                .filter((choice) => choice.length > 0);
              const matchingPairs = question.matchingPairs
                .map((pair) => ({
                  prompt: pair.prompt.trim(),
                  answer: pair.answer.trim(),
                }))
                .filter((pair) => pair.prompt && pair.answer);
              const correctAnswer =
                question.type === "multiple_choice"
                  ? JSON.stringify(
                      question.choices
                        .filter((choice) => choice.isCorrect && choice.text.trim())
                        .map((choice) => choice.text.trim()),
                    )
                  : question.type === "ordering"
                    ? JSON.stringify(choices)
                    : question.type === "matching"
                      ? JSON.stringify(
                          matchingPairs.map(
                            (pair) => `${pair.prompt}::${pair.answer}`,
                          ),
                        )
                      : question.correctAnswer.trim();

              return {
                ...(question.id ? { id: question.id } : {}),
                type: question.type,
                prompt: question.prompt,
                ...(question.type === "multiple_choice" ||
                question.type === "ordering"
                  ? { choices }
                  : {}),
                ...(correctAnswer ? { correctAnswer } : {}),
                ...(question.type === "multiple_choice"
                  ? { allowMultipleCorrect: question.allowMultipleCorrect }
                  : {}),
                ...(question.type === "matching" ? { matchingPairs } : {}),
                ...(question.type === "linear_scale"
                  ? {
                      scaleMin: Number(question.scaleMin),
                      scaleMax: Number(question.scaleMax),
                      scaleMinLabel: question.scaleMinLabel,
                      scaleMaxLabel: question.scaleMaxLabel,
                    }
                  : {}),
                ...(question.answerPlaceholder.trim()
                  ? { answerPlaceholder: question.answerPlaceholder.trim() }
                  : {}),
                points: Number(question.points),
              };
            })
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
    <div className="mx-auto max-w-7xl">
      <PageHeading
        eyebrow="Learning"
        title="Lesson composer"
        description="Create the post, materials, student work, and grading settings from one board."
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
        className="grid gap-5 xl:grid-cols-[220px_minmax(0,1fr)_320px] xl:items-start"
      >
        <aside className="hidden space-y-2 xl:sticky xl:top-20 xl:block">
          {[
            ["Details", "Title, instructions, format"],
            ["Materials", `${readyResourceCount}/${form.resources.length} ready`],
            ["Student work", `${readyQuestionCount}/${form.questions.length} ready`],
            ["Settings", `${totalPoints} pts`],
          ].map(([title, detail]) => (
            <div key={title} className="rounded-md border bg-card px-3 py-2 text-sm">
              <p className="font-medium">{title}</p>
              <p className="text-xs text-muted-foreground">{detail}</p>
            </div>
          ))}
        </aside>

        <div className="space-y-5">
          <Card className="overflow-hidden border-primary/15 py-0">
            <CardHeader className="border-b bg-muted/35 px-5 py-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle>Classroom composer</CardTitle>
                  <CardDescription>
                    {selectedLessonTypeLabel(form.lessonType)} in{" "}
                    {lessonRecord?.unit?.title ?? "this unit"}
                  </CardDescription>
                </div>
                <Badge variant={form.required ? "default" : "outline"}>
                  {form.required ? "Required" : "Optional"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-5 px-5 py-5">
              <div className="grid gap-3 md:grid-cols-5">
                {lessonTypeOptions.map((option) => {
                  const Icon = option.icon;
                  const isSelected = form.lessonType === option.value;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setLessonType(option.value)}
                      className={`rounded-md border p-3 text-left transition hover:border-primary/60 hover:bg-accent/45 ${
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
                  placeholder="Name the lesson students will see"
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
                  placeholder="Directions, context, rubric notes, or reading text."
                  className="min-h-36 resize-y"
                />
              </div>
              {needsVideo(form.lessonType) && (
                <div className="space-y-2">
                  <Label htmlFor="lesson-video" className="flex items-center gap-2">
                    <Film className="size-4 text-primary" />
                    YouTube video
                  </Label>
                  <Input
                    id="lesson-video"
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

          <Card className="overflow-hidden py-0">
            <CardHeader className="border-b bg-muted/25 px-5 py-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>Materials</CardTitle>
                  <CardDescription>
                    Attach links, references, files, or notes to the lesson.
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={() => addResource("link")}>
                    <Link2 className="size-4" />
                    Link
                  </Button>
                  <Button type="button" variant="outline" onClick={() => addResource("file")}>
                    <Paperclip className="size-4" />
                    File
                  </Button>
                  <Button type="button" variant="outline" onClick={() => addResource("note")}>
                    <FileText className="size-4" />
                    Note
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 px-5 py-5">
              {form.resources.length === 0 && (
                <div className="rounded-md border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
                  No materials attached.
                </div>
              )}
              {form.resources.map((resource, resourceIndex) => (
                <div
                  key={resource.clientId}
                  className="grid gap-3 rounded-md border bg-background p-4 shadow-sm md:grid-cols-[160px_1fr_auto]"
                >
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select
                      value={resource.resourceType}
                      onValueChange={(value: ResourceType) =>
                        updateResource(resource.clientId, { resourceType: value })
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="link">Link</SelectItem>
                        <SelectItem value="file">File</SelectItem>
                        <SelectItem value="note">Note</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor={`${resource.clientId}-title`}>
                        Material {resourceIndex + 1}
                      </Label>
                      <Input
                        id={`${resource.clientId}-title`}
                        value={resource.title}
                        onChange={(event) =>
                          updateResource(resource.clientId, {
                            title: event.target.value,
                          })
                        }
                        placeholder="Resource title"
                      />
                    </div>
                    {resource.resourceType !== "note" && (
                      <div className="space-y-2">
                        <Label htmlFor={`${resource.clientId}-url`}>URL</Label>
                        <Input
                          id={`${resource.clientId}-url`}
                          value={resource.url}
                          onChange={(event) =>
                            updateResource(resource.clientId, {
                              url: event.target.value,
                            })
                          }
                          placeholder="https://..."
                        />
                      </div>
                    )}
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor={`${resource.clientId}-notes`}>Notes</Label>
                      <Textarea
                        id={`${resource.clientId}-notes`}
                        value={resource.notes}
                        onChange={(event) =>
                          updateResource(resource.clientId, {
                            notes: event.target.value,
                          })
                        }
                        placeholder="Optional context for students"
                        className="min-h-20"
                      />
                    </div>
                  </div>
                  <div className="flex items-start justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeResource(resource.clientId)}
                      aria-label={`Remove material ${resourceIndex + 1}`}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="overflow-hidden py-0">
            <CardHeader className="border-b bg-muted/25 px-5 py-4">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle>Student work</CardTitle>
                    <CardDescription>
                      Add questions, uploads, written prompts, matching, or ordering.
                    </CardDescription>
                  </div>
                  <Badge variant="outline">
                    {readyQuestionCount} of {form.questions.length} ready
                  </Badge>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
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
              {form.questions.length === 0 && (
                <div className="rounded-md border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
                  No student work added.
                </div>
              )}
              {form.questions.map((question, questionIndex) => (
                <div
                  key={question.clientId}
                  className="rounded-md border bg-background p-4 shadow-sm"
                >
                  <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">Question {questionIndex + 1}</Badge>
                      <Badge variant="secondary">{questionTypeLabel(question.type)}</Badge>
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
                          changeQuestionType(question, value)
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {questionTypeOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
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
                      <div className="space-y-3 md:col-span-2">
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

                    {question.type === "ordering" && (
                      <div className="space-y-3 md:col-span-2">
                        <Label>Correct order</Label>
                        <div className="space-y-2">
                          {question.choices.map((choice, choiceIndex) => (
                            <div
                              key={choice.clientId}
                              className="grid grid-cols-[auto_1fr_auto] items-center gap-2"
                            >
                              <Badge variant="outline">{choiceIndex + 1}</Badge>
                              <Input
                                value={choice.text}
                                onChange={(event) =>
                                  updateChoice(
                                    question.clientId,
                                    choice.clientId,
                                    event.target.value,
                                  )
                                }
                                placeholder={`Step ${choiceIndex + 1}`}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() =>
                                  removeChoice(question.clientId, choice.clientId)
                                }
                                disabled={question.choices.length <= 2}
                                aria-label={`Remove step ${choiceIndex + 1}`}
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
                          Add item
                        </Button>
                      </div>
                    )}

                    {question.type === "matching" && (
                      <div className="space-y-3 md:col-span-2">
                        <Label>Matching pairs</Label>
                        <div className="space-y-2">
                          {question.matchingPairs.map((pair, pairIndex) => (
                            <div
                              key={pair.clientId}
                              className="grid gap-2 md:grid-cols-[1fr_1fr_auto]"
                            >
                              <Input
                                value={pair.prompt}
                                onChange={(event) =>
                                  updateMatchingPair(
                                    question.clientId,
                                    pair.clientId,
                                    { prompt: event.target.value },
                                  )
                                }
                                placeholder={`Prompt ${pairIndex + 1}`}
                              />
                              <Input
                                value={pair.answer}
                                onChange={(event) =>
                                  updateMatchingPair(
                                    question.clientId,
                                    pair.clientId,
                                    { answer: event.target.value },
                                  )
                                }
                                placeholder={`Match ${pairIndex + 1}`}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() =>
                                  removeMatchingPair(question.clientId, pair.clientId)
                                }
                                disabled={question.matchingPairs.length <= 2}
                                aria-label={`Remove pair ${pairIndex + 1}`}
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
                          onClick={() => addMatchingPair(question.clientId)}
                        >
                          <Plus className="size-4" />
                          Add pair
                        </Button>
                      </div>
                    )}

                    {question.type === "linear_scale" && (
                      <div className="grid gap-3 md:col-span-2 md:grid-cols-5">
                        <div className="space-y-2">
                          <Label>Min</Label>
                          <Input
                            type="number"
                            value={question.scaleMin}
                            onChange={(event) =>
                              updateQuestion(question.clientId, {
                                scaleMin: event.target.value,
                              })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Max</Label>
                          <Input
                            type="number"
                            value={question.scaleMax}
                            onChange={(event) =>
                              updateQuestion(question.clientId, {
                                scaleMax: event.target.value,
                              })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Correct</Label>
                          <Input
                            type="number"
                            value={question.correctAnswer}
                            onChange={(event) =>
                              updateQuestion(question.clientId, {
                                correctAnswer: event.target.value,
                              })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Min label</Label>
                          <Input
                            value={question.scaleMinLabel}
                            onChange={(event) =>
                              updateQuestion(question.clientId, {
                                scaleMinLabel: event.target.value,
                              })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Max label</Label>
                          <Input
                            value={question.scaleMaxLabel}
                            onChange={(event) =>
                              updateQuestion(question.clientId, {
                                scaleMaxLabel: event.target.value,
                              })
                            }
                          />
                        </div>
                      </div>
                    )}

                    {question.type === "true_false" && (
                      <div className="space-y-2 md:col-span-2">
                        <Label>Correct answer</Label>
                        <Select
                          value={question.correctAnswer || "true"}
                          onValueChange={(value) =>
                            updateQuestion(question.clientId, { correctAnswer: value })
                          }
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="true">True</SelectItem>
                            <SelectItem value="false">False</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {["fill_blank", "number", "short_answer", "url"].includes(
                      question.type,
                    ) && (
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor={`${question.clientId}-answer`}>
                          {question.type === "short_answer" || question.type === "url"
                            ? "Answer key"
                            : "Correct answer"}
                        </Label>
                        <Input
                          id={`${question.clientId}-answer`}
                          type={question.type === "number" ? "number" : "text"}
                          value={question.correctAnswer}
                          onChange={(event) =>
                            updateQuestion(question.clientId, {
                              correctAnswer: event.target.value,
                            })
                          }
                          placeholder={
                            question.type === "short_answer" || question.type === "url"
                              ? "Leave blank for manual review"
                              : "Expected answer"
                          }
                        />
                      </div>
                    )}

                    {["paragraph", "short_answer", "url"].includes(question.type) && (
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor={`${question.clientId}-placeholder`}>
                          Student placeholder
                        </Label>
                        <Input
                          id={`${question.clientId}-placeholder`}
                          value={question.answerPlaceholder}
                          onChange={(event) =>
                            updateQuestion(question.clientId, {
                              answerPlaceholder: event.target.value,
                            })
                          }
                          placeholder="Optional prompt inside the answer field"
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-20">
          <Card className="py-0">
            <CardHeader className="border-b px-5 py-4">
              <CardTitle>Settings</CardTitle>
              <CardDescription>Publishing and grading controls.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 px-5 py-5">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
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

                {hasStudentWork && (
                  <div className="space-y-2">
                    <Label htmlFor="passing-score" className="flex items-center gap-2">
                      <CheckCircle2 className="size-4 text-primary" />
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
                    {selectedLessonTypeLabel(form.lessonType)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Materials</span>
                  <span className="font-medium">
                    {readyResourceCount}/{form.resources.length}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Questions</span>
                  <span className="font-medium">
                    {readyQuestionCount}/{form.questions.length}
                  </span>
                </div>
                {hasStudentWork && (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Points</span>
                    <span className="font-medium">{totalPoints}</span>
                  </div>
                )}
              </div>

              {!canSave && (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  Add the missing title, materials, student work, or grading values before saving.
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
        </aside>
      </form>
    </div>
  );
}
