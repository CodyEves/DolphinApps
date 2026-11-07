import { useConvexAuth } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import { ArrowRight, ClipboardCheck, LayoutGrid, Pencil } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

import {
  CheckTypeLabel,
  StatusPill,
  formatMinutes,
  groupByStage,
  pathColors,
  pathIcon,
  statusMeta,
} from "@/components/learning/learning-ui";
import type { CheckType, PathColor, SkillStatus } from "@/components/learning/learning-ui";
import { PageHeading } from "@/components/page-heading";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { ListSkeleton } from "@/components/ui/skeleton";

type SkillRow = {
  _id: Id<"learningSkills">;
  stage: string;
  title: string;
  checkType: CheckType;
  estimatedMinutes: number;
  isPublished: boolean;
  status: SkillStatus;
};

function countByStatus(skills: SkillRow[]) {
  return {
    done: skills.filter((skill) => skill.status === "completed").length,
    waiting: skills.filter((skill) => skill.status === "signoff_requested").length,
    needsWork: skills.filter((skill) => skill.status === "needs_work").length,
    total: skills.length,
  };
}

function nextSkill(skills: SkillRow[]) {
  return (
    skills.find((skill) => skill.status === "needs_work") ??
    skills.find((skill) => skill.status === null)
  );
}

export function LearningHomePage() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const data = useQuery(api.learning.myLearning, isAuthenticated ? {} : "skip");
  const setFocusPath = useMutation(api.learning.setFocusPath);
  const loadStarterContent = useMutation(api.learning.loadStarterContent);
  const [selectedPathId, setSelectedPathId] = useState<Id<"learningPaths"> | null>(null);
  const [isSeeding, setIsSeeding] = useState(false);

  const paths = data?.paths ?? [];
  const activePath =
    paths.find((path) => path._id === selectedPathId) ??
    paths.find((path) => path._id === data?.focusPathId) ??
    paths[0];

  function choosePath(pathId: Id<"learningPaths">) {
    setSelectedPathId(pathId);

    if (data?.canTrackProgress) {
      void setFocusPath({ pathId }).catch(() => undefined);
    }
  }

  async function handleSeed() {
    setIsSeeding(true);

    try {
      const result = await loadStarterContent({});
      toast.success(`Added ${result.pathsAdded} paths and ${result.skillsAdded} skills`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't load the starter skills");
    } finally {
      setIsSeeding(false);
    }
  }

  const actions = data && (data.canReview || data.canEdit) && (
    <>
      {data.canReview && (
        <>
          <Button asChild variant="outline">
            <Link to="/training/sign-offs">
              <ClipboardCheck className="size-4" />
              Sign-offs
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/training/team">
              <LayoutGrid className="size-4" />
              Team progress
            </Link>
          </Button>
        </>
      )}
      {data.canEdit && (
        <Button asChild variant="outline">
          <Link to="/training/manage">
            <Pencil className="size-4" />
            Edit skills
          </Link>
        </Button>
      )}
    </>
  );

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeading
        title="Your skills by path"
        description="Pick your path, work through the skills at your own pace, and prove each one with a self-check, a quiz, or a mentor sign-off."
        actions={actions}
      />

      {!isLoading && !isAuthenticated && (
        <Card className="border-dashed">
          <CardHeader className="items-center text-center">
            <CardTitle>Sign in to see your skills</CardTitle>
            <CardDescription>Your progress is saved to your team account.</CardDescription>
          </CardHeader>
        </Card>
      )}

      {isAuthenticated && data === undefined && (
        <ListSkeleton label="Loading your skills" />
      )}

      {data && paths.length === 0 && (
        <Card className="border-dashed">
          <CardHeader className="items-center gap-3 text-center">
            <CardTitle>No skills yet</CardTitle>
            <CardDescription className="max-w-md">
              {data.canEdit
                ? "Load the starter skills for Mechanical & Design, Electrical & Control Systems, and Business, Media & Outreach. You can edit them afterward."
                : "Your mentors haven't published any skills yet. Check back soon."}
            </CardDescription>
            {data.canEdit && (
              <Button onClick={handleSeed} pending={isSeeding}>
                {"Load starter skills"}
              </Button>
            )}
          </CardHeader>
        </Card>
      )}

      {data && activePath && (
        <div className="grid gap-6">
          <div role="tablist" aria-label="Learning paths" className="grid gap-2 sm:grid-cols-3">
            {paths.map((path) => {
              const Icon = pathIcon(path.slug);
              const color = pathColors[path.color as PathColor];
              const counts = countByStatus(path.skills);
              const isActive = path._id === activePath._id;

              return (
                <button
                  key={path._id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => choosePath(path._id)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border bg-card px-4 py-3 text-left transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
                    isActive && cn("ring-2", color.ring, "border-transparent"),
                  )}
                >
                  <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-md", color.soft, color.text)}>
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{path.title}</span>
                    <span className="block text-xs text-muted-foreground tabular-nums">
                      {counts.done} of {counts.total} skills
                      {!path.isPublished && " · hidden"}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          <PathPanel
            title={activePath.title}
            summary={activePath.summary}
            color={activePath.color as PathColor}
            skills={activePath.skills}
            canTrackProgress={data.canTrackProgress}
          />
        </div>
      )}
    </div>
  );
}

function PathPanel({
  title,
  summary,
  color,
  skills,
  canTrackProgress,
}: {
  title: string;
  summary: string;
  color: PathColor;
  skills: SkillRow[];
  canTrackProgress: boolean;
}) {
  const counts = countByStatus(skills);
  const percent = counts.total === 0 ? 0 : Math.round((counts.done / counts.total) * 100);
  const upNext = nextSkill(skills);
  const stages = groupByStage(skills);
  const palette = pathColors[color];

  return (
    <div className="grid gap-6">
      <section className="grid gap-4 rounded-lg border bg-card p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:items-center">
        <div className="min-w-0 space-y-4">
          <div className="space-y-1.5">
            <h2 className="text-xl font-semibold">{title}</h2>
            <p className="max-w-[60ch] text-sm leading-6 text-muted-foreground">{summary}</p>
          </div>
          <div className="space-y-2">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm">
              <span className="font-medium tabular-nums">
                {counts.done} of {counts.total} done
              </span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {counts.waiting > 0 && `${counts.waiting} waiting for a mentor`}
                {counts.waiting > 0 && counts.needsWork > 0 && " · "}
                {counts.needsWork > 0 && `${counts.needsWork} need work`}
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label={`${title} progress`}>
              <div className={cn("h-full rounded-full transition-[width]", palette.bar)} style={{ width: `${percent}%` }} />
            </div>
          </div>
        </div>

        <div className={cn("rounded-md p-4", palette.soft)}>
          {upNext ? (
            <div className="space-y-3">
              <p className={cn("text-sm font-semibold", palette.text)}>
                {upNext.status === "needs_work" ? "Fix this next" : "Up next"} · {upNext.stage}
              </p>
              <p className="text-sm font-semibold leading-snug">{upNext.title}</p>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs text-muted-foreground">
                  {formatMinutes(upNext.estimatedMinutes)} · <CheckTypeLabel checkType={upNext.checkType} />
                </span>
                <Button asChild variant="cta">
                  <Link to={`/training/skills/${upNext._id}`}>
                    {canTrackProgress ? "Start" : "Open"}
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              <p className={cn("text-sm font-semibold", palette.text)}>
                {counts.waiting > 0 ? "Almost there" : "Path complete"}
              </p>
              <p className="text-sm">
                {counts.waiting > 0
                  ? "Everything else is done. Your mentor sign-offs are in the queue."
                  : "You've finished every skill in this path. Try another path to cross-train."}
              </p>
            </div>
          )}
        </div>
      </section>

      <div className="grid gap-5">
        {stages.map((group) => {
          const stageDone = group.items.filter((skill) => skill.status === "completed").length;

          return (
            <section key={group.stage} aria-labelledby={`stage-${group.stage}`} className="space-y-2">
              <div className="flex items-baseline justify-between gap-3">
                <h3 id={`stage-${group.stage}`} className="text-base font-semibold">
                  {group.stage}
                </h3>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {stageDone} of {group.items.length}
                </span>
              </div>
              <ul className="divide-y overflow-hidden rounded-lg border bg-card">
                {group.items.map((skill) => {
                  const meta = statusMeta(skill.status, skill.checkType);

                  return (
                    <li key={skill._id}>
                      <Link
                        to={`/training/skills/${skill._id}`}
                        className="group flex items-start gap-3 px-4 py-3 transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                      >
                        <meta.icon
                          className={cn(
                            "mt-0.5 size-5 shrink-0",
                            skill.status === "completed"
                              ? "text-emerald-600 dark:text-emerald-400"
                              : skill.status === "signoff_requested"
                                ? "text-amber-600 dark:text-amber-400"
                                : skill.status === "needs_work"
                                  ? "text-rose-600 dark:text-rose-400"
                                  : "text-muted-foreground",
                          )}
                          aria-hidden
                        />
                        <span className="min-w-0 flex-1 space-y-1">
                          <span className={cn("block text-sm font-medium leading-snug", skill.status === "completed" && "text-muted-foreground")}>
                            {skill.title}
                          </span>
                          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <CheckTypeLabel checkType={skill.checkType} />
                            <span className="text-xs text-muted-foreground">{formatMinutes(skill.estimatedMinutes)}</span>
                            {!skill.isPublished && <span className="text-xs text-muted-foreground">Hidden from students</span>}
                          </span>
                        </span>
                        <span className="hidden shrink-0 sm:block">
                          {skill.status && <StatusPill status={skill.status} checkType={skill.checkType} />}
                        </span>
                        <ArrowRight className="mt-0.5 size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
