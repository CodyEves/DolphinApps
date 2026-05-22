import { useConvexAuth } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import { ArrowLeft, Plus, Save, Trash2 } from "lucide-react";
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

  useEffect(() => {
    if (!lessonRecord) {
      return;
    }

    // Hydrate editable form state after the Convex lesson record loads.
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
    if (!form.title.trim()) {
      return false;
    }

    if (isQuestionLesson && form.questions.length === 0) {
      return false;
    }

    return true;
  }, [form.questions.length, form.title, isQuestionLesson]);

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
          eyebrow="Training"
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
          eyebrow="Training"
          title="Sign in required"
          description="Sign in with an admin account to edit lessons."
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

  if (viewer === undefined || (isAdmin && lessonId && lessonRecord === undefined)) {
    return (
      <div className="mx-auto max-w-6xl">
        <PageHeading
          eyebrow="Training"
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
          eyebrow="Training"
          title="Admin access required"
          description="Only admins can edit lessons."
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

  if (lessonRecord === null) {
    return (
      <div className="mx-auto max-w-6xl">
        <PageHeading
          eyebrow="Training"
          title="Lesson not found"
          description="This lesson may have been removed."
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
    <div className="mx-auto max-w-6xl">
      <PageHeading
        eyebrow="Training"
        title="Edit lesson"
        description="Choose whether this is video-only, video plus assignment, or an exam-style lesson."
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

      <form onSubmit={handleSave} className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Lesson details</CardTitle>
            <CardDescription>
              The track outline shows the title and lesson type.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="lesson-title">Title</Label>
              <Input
                id="lesson-title"
                value={form.title}
                onChange={(event) =>
                  setForm((current) => ({ ...current, title: event.target.value }))
                }
                required
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="lesson-description">Description</Label>
              <Textarea
                id="lesson-description"
                value={form.description}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Lesson type</Label>
              <Select
                value={form.lessonType}
                onValueChange={(value: LessonType) =>
                  setForm((current) => ({
                    ...current,
                    lessonType: value,
                    questions:
                      needsQuestions(value) && current.questions.length === 0
                        ? [createQuestion()]
                        : current.questions,
                  }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="video">Video only</SelectItem>
                  <SelectItem value="video_assignment">Video + assignment</SelectItem>
                  <SelectItem value="exam">Questions / exam only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="lesson-minutes">Estimated minutes</Label>
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
            {needsVideo(form.lessonType) && (
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="lesson-youtube">YouTube URL</Label>
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
            {isQuestionLesson && (
              <div className="space-y-2">
                <Label htmlFor="passing-score">Passing score</Label>
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
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={form.required}
                onCheckedChange={(checked) =>
                  setForm((current) => ({
                    ...current,
                    required: checked === true,
                  }))
                }
              />
              Required lesson
            </label>
          </CardContent>
        </Card>

        {isQuestionLesson && (
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>Assignment questions</CardTitle>
                  <CardDescription>
                    Add multiple choice, fill in the blank, file upload, or short answer prompts.
                  </CardDescription>
                </div>
                <Button type="button" variant="outline" onClick={() => addQuestion()}>
                  <Plus className="size-4" />
                  Add question
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {form.questions.map((question, questionIndex) => (
                <div key={question.clientId} className="rounded-md border p-4">
                  <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">Question {questionIndex + 1}</Badge>
                      <Badge variant="secondary">{question.type.replace("_", " ")}</Badge>
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

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Button asChild type="button" variant="outline">
            <Link to={trackBackHref}>
              <ArrowLeft className="size-4" />
              Back to track
            </Link>
          </Button>
          <Button type="submit" disabled={isSaving || !canSave}>
            <Save className="size-4" />
            {isSaving ? "Saving..." : "Save lesson"}
          </Button>
        </div>
      </form>
    </div>
  );
}
