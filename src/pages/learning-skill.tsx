import { useConvexAuth } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleCheck,
  Clock,
  ExternalLink,
  Lightbulb,
  Pencil,
  RotateCcw,
  Send,
  Target,
  X,
} from "lucide-react";
import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useParams } from "react-router";
import { toast } from "sonner";

import {
  StatusPill,
  checkTypeMeta,
  formatMinutes,
  formatShortDate,
  pathColors,
  resourceKindMeta,
} from "@/components/learning/learning-ui";
import type { PathColor, ResourceKind } from "@/components/learning/learning-ui";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { PageSkeleton } from "@/components/ui/skeleton";

function errorText(error: unknown, fallback: string) {
  return error instanceof Error ? error.message.replace(/^.*Uncaught Error: /, "").split("\n")[0] : fallback;
}

export function LearningSkillPage() {
  const { skillId } = useParams();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const data = useQuery(
    api.learning.skill,
    isAuthenticated && skillId ? { skillId: skillId as Id<"learningSkills"> } : "skip",
  );

  if (!isLoading && !isAuthenticated) {
    return (
      <div className="mx-auto max-w-3xl">
        <Card className="border-dashed">
          <CardHeader className="items-center text-center">
            <CardTitle>Sign in to open this skill</CardTitle>
            <CardDescription>Your progress is saved to your team account.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (data === undefined) {
    return <PageSkeleton rows={3} label="Loading skill" />;
  }

  if (data === null || data.notFound) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Card className="border-dashed">
          <CardHeader className="items-center text-center">
            <CardTitle>This skill isn't available</CardTitle>
            <CardDescription>It may have been removed or hidden by a mentor.</CardDescription>
          </CardHeader>
        </Card>
        <Button asChild variant="outline">
          <Link to="/training">
            <ArrowLeft className="size-4" />
            Back to Learning
          </Link>
        </Button>
      </div>
    );
  }

  const { skill, path, progress, previous, next, position } = data;
  const palette = pathColors[path.color as PathColor];
  const check = checkTypeMeta[skill.checkType];

  return (
    <div className="mx-auto max-w-5xl">
      <nav aria-label="Breadcrumb" className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
        <Link to="/training" className="hover:text-foreground">
          Learning
        </Link>
        <span aria-hidden>/</span>
        <span className={cn("font-medium", palette.text)}>{path.title}</span>
        <span aria-hidden>/</span>
        <span>{skill.stage}</span>
        <span className="ml-auto text-xs tabular-nums">
          Skill {position.index} of {position.total}
        </span>
      </nav>

      <header className="mb-6 space-y-3 border-b pb-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn("inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold", palette.soft, palette.text)}>
            <check.icon className="size-3.5" aria-hidden />
            {check.label}
          </span>
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="size-3.5" aria-hidden />
            About {formatMinutes(skill.estimatedMinutes)}
          </span>
          {progress && <StatusPill status={progress.status} checkType={skill.checkType} />}
          {!skill.isPublished && <span className="text-xs text-muted-foreground">Hidden from students</span>}
        </div>
        <h1 className="max-w-[40ch] text-2xl font-semibold tracking-tight text-balance sm:text-[1.75rem]">{skill.title}</h1>
        {data.canEdit && (
          <Button asChild variant="ghost" size="sm" className="-ml-2">
            <Link to={`/training/manage?skill=${skill._id}`}>
              <Pencil className="size-4" />
              Edit this skill
            </Link>
          </Button>
        )}
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:items-start">
        <div className="min-w-0 space-y-6">
          <section aria-labelledby="success-heading" className="space-y-2">
            <h2 id="success-heading" className="flex items-center gap-2 text-base font-semibold">
              <Target className="size-4 text-muted-foreground" aria-hidden />
              Success looks like
            </h2>
            <p className="max-w-[65ch] text-sm leading-6">{skill.successCriteria}</p>
          </section>

          <section aria-labelledby="learn-heading" className="space-y-3">
            <h2 id="learn-heading" className="text-base font-semibold">
              Learn it
            </h2>
            {skill.resources.length === 0 ? (
              <p className="text-sm text-muted-foreground">Your mentor hasn't added resources yet. Ask in class.</p>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {skill.resources.map((resource) => {
                  const kind = resourceKindMeta[resource.kind as ResourceKind];

                  return (
                    <li key={resource.url + resource.title} className="min-w-0">
                      <a
                        href={resource.url}
                        target="_blank"
                        rel="noreferrer"
                        className="group flex h-full items-start gap-3 rounded-lg border bg-card p-3 transition-colors hover:border-ring/40 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
                      >
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                          <kind.icon className="size-4" aria-hidden />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium leading-snug">{resource.title}</span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {resource.source} · {kind.label}
                            {resource.minutes ? ` · ${resource.minutes} min` : ""}
                          </span>
                        </span>
                        <ExternalLink className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                      </a>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {skill.practice && (
            <section aria-labelledby="practice-heading" className={cn("space-y-2 rounded-lg p-4", palette.soft)}>
              <h2 id="practice-heading" className={cn("flex items-center gap-2 text-base font-semibold", palette.text)}>
                <Lightbulb className="size-4" aria-hidden />
                Try it
              </h2>
              <p className="max-w-[65ch] text-sm leading-6">{skill.practice}</p>
            </section>
          )}

          <nav aria-label="Skill navigation" className="flex flex-wrap justify-between gap-3 border-t pt-4">
            {previous ? (
              <Button asChild variant="outline" className="max-w-full">
                <Link to={`/training/skills/${previous._id}`}>
                  <ArrowLeft className="size-4" />
                  <span className="truncate">Previous skill</span>
                </Link>
              </Button>
            ) : (
              <Button asChild variant="outline">
                <Link to="/training">
                  <ArrowLeft className="size-4" />
                  All skills
                </Link>
              </Button>
            )}
            {next && (
              <Button asChild variant="outline" className="max-w-full">
                <Link to={`/training/skills/${next._id}`}>
                  <span className="truncate">Next skill</span>
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            )}
          </nav>
        </div>

        <aside className="lg:sticky lg:top-4">
          <div className="rounded-lg border bg-card p-4">
            <h2 className="mb-1 text-base font-semibold">Prove it</h2>
            <p className="mb-4 text-sm text-muted-foreground">{check.hint}</p>
            {!data.canTrackProgress ? (
              <p className="text-sm text-muted-foreground">Your profile is view-only, so progress can't be saved.</p>
            ) : skill.checkType === "self" ? (
              <SelfCheck skillId={skill._id} completedAt={progress?.status === "completed" ? progress.completedAt : undefined} />
            ) : skill.checkType === "quiz" ? (
              <QuizCheck
                key={skill._id}
                skillId={skill._id}
                questions={skill.quiz}
                passPercent={skill.passPercent}
                completedAt={progress?.status === "completed" ? progress.completedAt : undefined}
                bestPercent={progress?.quizBestPercent}
              />
            ) : (
              <MentorCheck key={skill._id} skillId={skill._id} progress={progress} />
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function SelfCheck({ skillId, completedAt }: { skillId: Id<"learningSkills">; completedAt: number | undefined }) {
  const markDone = useMutation(api.learning.markDone);
  const undoDone = useMutation(api.learning.undoDone);
  const [isSaving, setIsSaving] = useState(false);

  async function run(action: () => Promise<unknown>, success: string) {
    setIsSaving(true);

    try {
      await action();
      toast.success(success);
    } catch (error) {
      toast.error(errorText(error, "Couldn't save that"));
    } finally {
      setIsSaving(false);
    }
  }

  if (completedAt) {
    return (
      <div className="space-y-3">
        <p className="flex animate-rise items-center gap-2 text-sm font-medium text-success">
          <CircleCheck className="size-5 animate-pop" aria-hidden />
          Marked done on {formatShortDate(completedAt)}
        </p>
        <Button variant="ghost" size="sm" pending={isSaving} onClick={() => run(() => undoDone({ skillId }), "Marked not done")}>
          <RotateCcw className="size-4" />
          Mark not done
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm">Be honest: can you do this without help, the way “Success looks like” describes?</p>
      <Button variant="cta" size="lg" className="w-full" pending={isSaving} onClick={() => run(() => markDone({ skillId }), "Nice work. Skill marked done.")}>
        <Check className="size-4" />
        I can do this
      </Button>
    </div>
  );
}

type QuizResult = {
  percent: number;
  passed: boolean;
  passPercent: number;
  correctCount: number;
  total: number;
  results: { correct: boolean; correctIndex: number; explanation: string | null }[];
};

function QuizCheck({
  skillId,
  questions,
  passPercent,
  completedAt,
  bestPercent,
}: {
  skillId: Id<"learningSkills">;
  questions: { prompt: string; options: string[] }[];
  passPercent: number;
  completedAt: number | undefined;
  bestPercent: number | undefined;
}) {
  const submitQuiz = useMutation(api.learning.submitQuiz);
  const [answers, setAnswers] = useState<number[]>(() => questions.map(() => -1));
  const [result, setResult] = useState<QuizResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const allAnswered = answers.every((answer) => answer >= 0);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const graded = await submitQuiz({ skillId, answers });
      setResult(graded);

      if (graded.passed) {
        toast.success(`Passed with ${graded.percent}%`);
      }
    } catch (error) {
      toast.error(errorText(error, "Couldn't grade the quiz"));
    } finally {
      setIsSubmitting(false);
    }
  }

  function retry() {
    setResult(null);
    setAnswers(questions.map(() => -1));
  }

  if (questions.length === 0) {
    return <p className="text-sm text-muted-foreground">This quiz has no questions yet.</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {completedAt && !result && (
        <p className="flex items-center gap-2 text-sm font-medium text-success">
          <CircleCheck className="size-5 animate-pop" aria-hidden />
          Passed on {formatShortDate(completedAt)}
          {bestPercent !== undefined && ` · best ${bestPercent}%`}
        </p>
      )}
      {!completedAt && !result && (
        <p className="text-xs text-muted-foreground">
          {questions.length} questions · pass with {passPercent}%
          {bestPercent !== undefined && ` · your best so far is ${bestPercent}%`}
        </p>
      )}

      <ol className="space-y-4">
        {questions.map((question, questionIndex) => {
          const graded = result?.results[questionIndex];

          return (
            <li key={questionIndex}>
              <fieldset className="space-y-2" disabled={!!result}>
                <legend className="text-sm font-medium leading-snug">
                  {questionIndex + 1}. {question.prompt}
                </legend>
                <div className="grid gap-1.5">
                  {question.options.map((option, optionIndex) => {
                    const inputId = `q${questionIndex}-o${optionIndex}`;
                    const chosen = answers[questionIndex] === optionIndex;
                    const isCorrect = graded && graded.correctIndex === optionIndex;
                    const isWrongChoice = graded && chosen && !graded.correct;

                    return (
                      <label
                        key={optionIndex}
                        htmlFor={inputId}
                        className={cn(
                          "flex cursor-pointer items-start gap-2 rounded-md border px-3 py-2 text-sm transition-colors",
                          !result && "hover:bg-accent",
                          !result && chosen && "border-ring bg-accent",
                          isCorrect && "border-emerald-600/40 bg-emerald-50 dark:border-emerald-400/40 dark:bg-emerald-950/40",
                          isWrongChoice && "border-rose-500/40 bg-rose-50 dark:border-rose-400/40 dark:bg-rose-950/40",
                          result && "cursor-default",
                        )}
                      >
                        <input
                          id={inputId}
                          type="radio"
                          name={`question-${questionIndex}`}
                          className="mt-0.5 accent-[var(--primary)]"
                          checked={chosen}
                          onChange={() =>
                            setAnswers((current) => current.map((value, index) => (index === questionIndex ? optionIndex : value)))
                          }
                        />
                        <span className="min-w-0 flex-1">{option}</span>
                        {isCorrect && <Check className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-label="Correct answer" />}
                        {isWrongChoice && <X className="mt-0.5 size-4 shrink-0 text-rose-600 dark:text-rose-400" aria-label="Your answer" />}
                      </label>
                    );
                  })}
                </div>
                {graded?.explanation && <p className="text-xs leading-5 text-muted-foreground">{graded.explanation}</p>}
              </fieldset>
            </li>
          );
        })}
      </ol>

      {result ? (
        <div className="animate-rise space-y-3 border-t pt-3">
          <p
            key={result.percent}
            className={cn(
              "text-sm font-semibold",
              !result.passed && "animate-shake",
              result.passed ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300",
            )}
          >
            {result.correctCount} of {result.total} correct ({result.percent}%).{" "}
            {result.passed ? "Skill complete." : `You need ${result.passPercent}% to pass. Review the explanations and try again.`}
          </p>
          <Button type="button" variant="outline" className="w-full" onClick={retry}>
            <RotateCcw className="size-4" />
            {result.passed ? "Take it again" : "Try again"}
          </Button>
        </div>
      ) : (
        <Button type="submit" variant="cta" size="lg" className="w-full" disabled={!allAnswered} pending={isSubmitting}>
          {allAnswered ? "Check my answers" : "Answer every question"}
        </Button>
      )}
    </form>
  );
}

type MentorProgress = {
  status: "completed" | "signoff_requested" | "needs_work";
  completedAt?: number;
  evidenceNote?: string;
  evidenceUrl?: string;
  requestedAt?: number;
  reviewedAt?: number;
  mentorNote?: string;
  reviewerName: string | null;
} | null;

function MentorCheck({ skillId, progress }: { skillId: Id<"learningSkills">; progress: MentorProgress }) {
  const requestSignoff = useMutation(api.learning.requestSignoff);
  const cancelSignoffRequest = useMutation(api.learning.cancelSignoffRequest);
  const [note, setNote] = useState(progress?.evidenceNote ?? "");
  const [evidenceUrl, setEvidenceUrl] = useState(progress?.evidenceUrl ?? "");
  const [isSaving, setIsSaving] = useState(false);

  async function handleRequest(event: FormEvent) {
    event.preventDefault();
    setIsSaving(true);

    try {
      await requestSignoff({ skillId, note, evidenceUrl });
      toast.success("Sent to your mentors");
    } catch (error) {
      toast.error(errorText(error, "Couldn't send the request"));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCancel() {
    setIsSaving(true);

    try {
      await cancelSignoffRequest({ skillId });
      toast.success("Request withdrawn");
    } catch (error) {
      toast.error(errorText(error, "Couldn't withdraw the request"));
    } finally {
      setIsSaving(false);
    }
  }

  if (progress?.status === "completed") {
    return (
      <div className="space-y-1">
        <p className="flex animate-rise items-center gap-2 text-sm font-medium text-success">
          <CircleCheck className="size-5 animate-pop" aria-hidden />
          Signed off on {formatShortDate(progress.completedAt)}
        </p>
        {progress.reviewerName && <p className="text-xs text-muted-foreground">By {progress.reviewerName}</p>}
        {progress.mentorNote && <p className="pt-2 text-sm">"{progress.mentorNote}"</p>}
      </div>
    );
  }

  if (progress?.status === "signoff_requested") {
    return (
      <div className="space-y-3">
        <p className="text-sm">
          Sent {formatShortDate(progress.requestedAt)}. A mentor will review it or check you off in class.
        </p>
        {progress.evidenceNote && <p className="rounded-md bg-muted p-2 text-sm">{progress.evidenceNote}</p>}
        <Button variant="ghost" size="sm" pending={isSaving} onClick={handleCancel}>
          <X className="size-4" />
          Withdraw request
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleRequest} className="space-y-3">
      {progress?.status === "needs_work" && (
        <div className="rounded-md border border-rose-500/30 bg-rose-50 p-3 text-sm dark:border-rose-400/30 dark:bg-rose-950/40">
          <p className="font-medium">
            Feedback{progress.reviewerName ? ` from ${progress.reviewerName}` : ""}
          </p>
          {progress.mentorNote && <p className="mt-1">{progress.mentorNote}</p>}
        </div>
      )}
      <p className="text-sm">Ready? Show a mentor in class, or send what you made for review.</p>
      <div className="space-y-1.5">
        <Label htmlFor="signoff-note">What did you do? (optional)</Label>
        <Textarea
          id="signoff-note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="For example: crimped 5 Powerpoles, all passed the pull test"
          rows={3}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="signoff-link">Link to your work (optional)</Label>
        <Input
          id="signoff-link"
          type="url"
          value={evidenceUrl}
          onChange={(event) => setEvidenceUrl(event.target.value)}
          placeholder="https://… photo, doc, or Onshape link"
        />
      </div>
      <Button type="submit" variant="cta" size="lg" className="w-full" pending={isSaving}>
        <Send className="size-4" />
        {progress?.status === "needs_work" ? "Ask again" : "Ask for sign-off"}
      </Button>
    </form>
  );
}
