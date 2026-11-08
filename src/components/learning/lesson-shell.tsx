import { useConvexAuth } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router";

import { checkTypeMeta } from "@/components/learning/learning-ui";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { MentorCheck, QuizCheck, SelfCheck } from "@/pages/learning-skill";
import { api } from "@convex/_generated/api";

export type LessonChapter = {
  id: string;
  title: string;
  minutes: number;
  render: () => ReactNode;
};

/**
 * Layout shared by every interactive lesson: a chapter list on the left,
 * one chapter at a time on the right, and Next/Back at the bottom.
 * The current chapter lives in the URL hash so links and refreshes keep your place.
 */
export function LessonShell({ title, chapters }: { title: string; chapters: LessonChapter[] }) {
  const location = useLocation();
  const navigate = useNavigate();
  const hash = location.hash.replace("#", "");
  const index = Math.max(0, chapters.findIndex((chapter) => chapter.id === hash));
  const chapter = chapters[index];
  const totalMinutes = chapters.reduce((sum, item) => sum + item.minutes, 0);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [index]);

  function go(target: number) {
    navigate({ hash: chapters[target].id });
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[14rem_minmax(0,1fr)]">
      <nav aria-label="Lesson chapters" className="lg:sticky lg:top-20 lg:self-start">
        <Link to="/training" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden />
          Learning
        </Link>
        <p className="mb-3 text-sm text-muted-foreground">About {totalMinutes} min</p>
        <ol className="grid gap-1">
          {chapters.map((item, itemIndex) => (
            <li key={item.id}>
              <Link
                to={{ hash: item.id }}
                aria-current={itemIndex === index ? "step" : undefined}
                className={cn(
                  "flex gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent",
                  itemIndex === index ? "bg-accent font-semibold text-foreground" : "text-muted-foreground",
                )}
              >
                <span className="w-4 shrink-0 tabular-nums">{itemIndex + 1}</span>
                <span>{item.title}</span>
              </Link>
            </li>
          ))}
        </ol>
      </nav>

      <article className="min-w-0 max-w-3xl">
        <header className="mb-6 space-y-2 border-b pb-6">
          <p className="text-sm text-muted-foreground">
            {title} · Chapter {index + 1} of {chapters.length} · {chapter.minutes} min
          </p>
          <h1 className="text-[1.75rem] leading-tight font-bold sm:text-[2rem]">{chapter.title}</h1>
        </header>

        <div key={chapter.id} className="animate-rise space-y-4 text-base leading-7 [&>p]:max-w-[65ch]">
          {chapter.render()}
        </div>

        <nav aria-label="Chapter navigation" className="mt-10 flex flex-wrap justify-between gap-3 border-t pt-5">
          {index > 0 ? (
            <Button variant="outline" onClick={() => go(index - 1)}>
              <ArrowLeft />
              {chapters[index - 1].title}
            </Button>
          ) : (
            <span />
          )}
          {index < chapters.length - 1 && (
            <Button variant="cta" onClick={() => go(index + 1)}>
              Next: {chapters[index + 1].title}
              <ArrowRight />
            </Button>
          )}
        </nav>
      </article>
    </div>
  );
}

/**
 * The last chapter of a lesson: shows the linked skill's own check (quiz,
 * self-check, or mentor sign-off) so finishing the lesson counts in Learning.
 */
export function SkillCheckChapter({ seedKey, intro }: { seedKey: string; intro?: ReactNode }) {
  const { isAuthenticated } = useConvexAuth();
  const skillId = useQuery(api.learning.skillIdBySeedKey, isAuthenticated ? { seedKey } : "skip");
  const data = useQuery(api.learning.skill, skillId ? { skillId } : "skip");

  if (!isAuthenticated) {
    return <p>Sign in to get credit for this skill.</p>;
  }

  if (skillId === undefined || (skillId && data === undefined)) {
    return (
      <div className="space-y-3" aria-busy>
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (!skillId || !data || data.notFound) {
    return (
      <p>
        This skill isn't published yet, so there is nothing to check off. A mentor can add it from Learning by clicking Load starter
        skills.
      </p>
    );
  }

  const { skill, progress } = data;
  const check = checkTypeMeta[skill.checkType];

  return (
    <>
      {intro}
      <p>
        This lesson counts toward the skill “{skill.title.replace(/^I can /, "")}”. {check.hint}
      </p>
      <div className="rounded-xl border bg-card p-5">
        <p className="mb-4 flex items-center gap-2 text-sm font-semibold">
          <check.icon className="size-4 text-primary" aria-hidden />
          {check.label}
        </p>
        {!data.canTrackProgress ? (
          <p className="text-sm text-muted-foreground">Your profile is view-only, so progress can't be saved.</p>
        ) : skill.checkType === "quiz" ? (
          <QuizCheck
            skillId={skill._id}
            questions={skill.quiz}
            passPercent={skill.passPercent}
            completedAt={progress?.status === "completed" ? progress.completedAt : undefined}
            bestPercent={progress?.quizBestPercent}
          />
        ) : skill.checkType === "self" ? (
          <SelfCheck skillId={skill._id} completedAt={progress?.status === "completed" ? progress.completedAt : undefined} />
        ) : (
          <MentorCheck skillId={skill._id} progress={progress} />
        )}
      </div>
      <p className="text-sm">
        <Link to={`/training/skills/${skill._id}`} className="text-primary hover:underline">
          Open the skill page
        </Link>{" "}
        for the practice task and more resources.
      </p>
    </>
  );
}

/** Pick-the-right-bucket exercise with instant feedback. */
export function Sorter<T extends string>({
  items,
  buckets,
}: {
  items: { text: string; answer: T; why: string }[];
  buckets: { value: T; label: string }[];
}) {
  return (
    <ol className="grid gap-3">
      {items.map((item, index) => (
        <SorterItem key={item.text} index={index} item={item} buckets={buckets} />
      ))}
    </ol>
  );
}


function SorterItem<T extends string>({
  index,
  item,
  buckets,
}: {
  index: number;
  item: { text: string; answer: T; why: string };
  buckets: { value: T; label: string }[];
}) {
  const [picked, setPicked] = useState<T | null>(null);
  const correct = picked === item.answer;

  return (
    <li className="rounded-lg border bg-card p-4">
      <p className="text-sm font-medium">
        <span className="mr-2 text-muted-foreground tabular-nums">{index + 1}.</span>
        {item.text}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {buckets.map((bucket) => (
          <Button
            key={bucket.value}
            type="button"
            size="sm"
            variant={picked === bucket.value ? (correct ? "default" : "destructive") : "outline"}
            onClick={() => setPicked(bucket.value)}
            aria-pressed={picked === bucket.value}
          >
            {bucket.label}
          </Button>
        ))}
      </div>
      {picked && (
        <p key={picked} className={cn("mt-3 text-sm", correct ? "animate-rise text-success" : "animate-shake text-destructive")}>
          <span className="font-semibold">{correct ? "Right. " : "Not quite. "}</span>
          {item.why}
        </p>
      )}
    </li>
  );
}
