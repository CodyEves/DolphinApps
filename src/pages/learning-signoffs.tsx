import { useConvexAuth } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import { ArrowLeft, Check, ClipboardCheck, ExternalLink, Undo2, UserCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

import { CheckTypeLabel, formatShortDate, pathColors } from "@/components/learning/learning-ui";
import type { PathColor } from "@/components/learning/learning-ui";
import { PageHeading } from "@/components/page-heading";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { canReviewLearning } from "@/lib/role-access";
import { cn } from "@/lib/utils";
import { useEffectiveRole } from "@/providers/role-preview-provider";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";

function errorText(error: unknown, fallback: string) {
  return error instanceof Error ? error.message.replace(/^.*Uncaught Error: /, "").split("\n")[0] : fallback;
}

export function LearningSignoffsPage() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const viewer = useQuery(api.profiles.viewer, isAuthenticated ? {} : "skip");
  const role = useEffectiveRole(viewer?.profile.role);
  const isReviewer = canReviewLearning(role);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeading
        eyebrow="Learning"
        title="Sign-offs"
        description="Review work students sent in, or sign off a whole group after a hands-on check in class."
        actions={
          <Button asChild variant="outline">
            <Link to="/training">
              <ArrowLeft className="size-4" />
              Learning
            </Link>
          </Button>
        }
      />

      {!isLoading && viewer !== undefined && !isReviewer ? (
        <Card className="border-dashed">
          <CardHeader className="items-center text-center">
            <CardTitle>Mentors only</CardTitle>
            <CardDescription>Only mentors, instructors, and admins can sign students off.</CardDescription>
          </CardHeader>
        </Card>
      ) : isReviewer ? (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:items-start">
          <RequestQueue />
          <InClassSignoff />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Loading…</p>
      )}
    </div>
  );
}

function RequestQueue() {
  const queue = useQuery(api.learning.signoffQueue, {});

  return (
    <section aria-labelledby="queue-heading" className="min-w-0 space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="queue-heading" className="text-lg font-semibold">
          Waiting for review
        </h2>
        {queue && <span className="text-sm text-muted-foreground tabular-nums">{queue.length}</span>}
      </div>
      {queue === undefined ? (
        <p className="text-sm text-muted-foreground">Loading requests…</p>
      ) : queue.length === 0 ? (
        <div className="flex items-center gap-3 rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
          <ClipboardCheck className="size-5 shrink-0" aria-hidden />
          No one is waiting. Requests show up here when a student asks for a sign-off.
        </div>
      ) : (
        <ul className="grid gap-3">
          {queue.map((item) => (
            <RequestCard key={item.progressId} item={item} />
          ))}
        </ul>
      )}
    </section>
  );
}

type QueueItem = {
  progressId: Id<"learningProgress">;
  studentName: string;
  skillId: Id<"learningSkills">;
  skillTitle: string;
  successCriteria: string;
  stage: string;
  pathTitle: string;
  pathColor: string;
  note?: string;
  evidenceUrl?: string;
  requestedAt: number;
};

function RequestCard({ item }: { item: QueueItem }) {
  const reviewSignoff = useMutation(api.learning.reviewSignoff);
  const [mode, setMode] = useState<"idle" | "feedback">("idle");
  const [note, setNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const palette = pathColors[item.pathColor as PathColor] ?? pathColors.blue;

  async function review(approved: boolean) {
    setIsSaving(true);

    try {
      await reviewSignoff({ progressId: item.progressId, approved, note: note || undefined });
      toast.success(approved ? `Signed off ${item.studentName}` : `Sent feedback to ${item.studentName}`);
    } catch (error) {
      toast.error(errorText(error, "Couldn't save the review"));
      setIsSaving(false);
    }
  }

  return (
    <li className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <p className="font-semibold">{item.studentName}</p>
        <p className="text-xs text-muted-foreground">Sent {formatShortDate(item.requestedAt)}</p>
      </div>
      <p className="mt-2 text-sm font-medium leading-snug">
        <Link to={`/training/skills/${item.skillId}`} className="hover:underline">
          {item.skillTitle}
        </Link>
      </p>
      <p className="mt-1 flex flex-wrap items-center gap-2 text-xs">
        <span className={cn("rounded px-1.5 py-0.5 font-medium", palette.soft, palette.text)}>{item.pathTitle}</span>
        <span className="text-muted-foreground">{item.stage}</span>
      </p>
      <p className="mt-3 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">Success looks like:</span> {item.successCriteria}
      </p>
      {(item.note || item.evidenceUrl) && (
        <div className="mt-3 space-y-1 rounded-md bg-muted p-3 text-sm">
          {item.note && <p>{item.note}</p>}
          {item.evidenceUrl && (
            <a href={item.evidenceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 break-all text-primary hover:underline">
              <ExternalLink className="size-3.5 shrink-0" aria-hidden />
              {item.evidenceUrl}
            </a>
          )}
        </div>
      )}

      {mode === "feedback" ? (
        <div className="mt-4 space-y-2">
          <Label htmlFor={`feedback-${item.progressId}`}>What should they work on?</Label>
          <Input
            id={`feedback-${item.progressId}`}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="For example: two crimps failed the pull test, redo those"
            autoFocus
          />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="destructive" disabled={isSaving || !note.trim()} onClick={() => review(false)}>
              Send feedback
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setMode("idle")}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" disabled={isSaving} onClick={() => review(true)}>
            <Check className="size-4" />
            Sign off
          </Button>
          <Button size="sm" variant="outline" disabled={isSaving} onClick={() => setMode("feedback")}>
            <Undo2 className="size-4" />
            Needs work
          </Button>
        </div>
      )}
    </li>
  );
}

function InClassSignoff() {
  const content = useQuery(api.learning.myLearning, {});
  const [pathId, setPathId] = useState<Id<"learningPaths"> | "">("");
  const [skillId, setSkillId] = useState<Id<"learningSkills"> | "">("");
  const [selected, setSelected] = useState<Set<Id<"users">>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const signOffStudents = useMutation(api.learning.signOffStudents);
  const paths = content?.paths ?? [];
  const activePathId = pathId || paths[0]?._id || "";
  const activePath = paths.find((path) => path._id === activePathId);
  const skills = activePath?.skills ?? [];
  const team = useQuery(api.learning.teamProgress, activePathId ? { pathId: activePathId } : "skip");
  const skillIndex = team?.skills.findIndex((skill) => skill._id === skillId) ?? -1;
  const students = useMemo(
    () =>
      (team?.students ?? []).map((student) => ({
        ...student,
        status: skillIndex >= 0 ? student.statuses[skillIndex] : null,
      })),
    [team, skillIndex],
  );

  function toggle(userId: Id<"users">) {
    setSelected((current) => {
      const nextSet = new Set(current);

      if (nextSet.has(userId)) {
        nextSet.delete(userId);
      } else {
        nextSet.add(userId);
      }

      return nextSet;
    });
  }

  async function handleSignOff() {
    if (!skillId || selected.size === 0) {
      return;
    }

    setIsSaving(true);

    try {
      const result = await signOffStudents({ skillId, userIds: [...selected] });
      toast.success(result.signedOff === 1 ? "Signed off 1 student" : `Signed off ${result.signedOff} students`);
      setSelected(new Set());
    } catch (error) {
      toast.error(errorText(error, "Couldn't sign off those students"));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section aria-labelledby="inclass-heading" className="min-w-0 space-y-3 rounded-lg border bg-card p-4 shadow-sm">
      <div className="space-y-1">
        <h2 id="inclass-heading" className="flex items-center gap-2 text-lg font-semibold">
          <UserCheck className="size-5 text-muted-foreground" aria-hidden />
          Sign off in class
        </h2>
        <p className="text-sm text-muted-foreground">Watched students do it? Pick the skill, check their names, and sign them off together.</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="inclass-path">Path</Label>
        <select
          id="inclass-path"
          className="h-9 w-full rounded-md border bg-card px-3 text-sm"
          value={activePathId}
          onChange={(event) => {
            setPathId(event.target.value as Id<"learningPaths">);
            setSkillId("");
            setSelected(new Set());
          }}
        >
          {paths.map((path) => (
            <option key={path._id} value={path._id}>
              {path.title}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="inclass-skill">Skill</Label>
        <select
          id="inclass-skill"
          className="h-9 w-full rounded-md border bg-card px-3 text-sm"
          value={skillId}
          onChange={(event) => {
            setSkillId(event.target.value as Id<"learningSkills">);
            setSelected(new Set());
          }}
        >
          <option value="">Choose a skill…</option>
          {skills.map((skill) => (
            <option key={skill._id} value={skill._id}>
              {skill.checkType === "mentor" ? "● " : ""}
              {skill.stage}: {skill.title.replace(/^I can /, "")}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">● marks skills that need a mentor sign-off.</p>
      </div>

      {skillId && (
        <div className="space-y-2">
          {team === undefined ? (
            <p className="text-sm text-muted-foreground">Loading students…</p>
          ) : students.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active students found.</p>
          ) : (
            <ul className="max-h-80 divide-y overflow-y-auto rounded-md border">
              {students.map((student) => {
                const done = student.status === "completed";
                const inputId = `student-${student.userId}`;

                return (
                  <li key={student.userId}>
                    <label htmlFor={inputId} className={cn("flex items-center gap-3 px-3 py-2 text-sm", done ? "text-muted-foreground" : "cursor-pointer hover:bg-accent")}>
                      <input
                        id={inputId}
                        type="checkbox"
                        className="size-4 accent-[var(--primary)]"
                        disabled={done}
                        checked={done || selected.has(student.userId)}
                        onChange={() => toggle(student.userId)}
                      />
                      <span className="min-w-0 flex-1 truncate">{student.name}</span>
                      {done && <span className="text-xs">Done</span>}
                      {student.status === "signoff_requested" && <span className="text-xs text-amber-700 dark:text-amber-300">Requested</span>}
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
          <Button className="w-full" disabled={selected.size === 0 || isSaving} onClick={handleSignOff}>
            <Check className="size-4" />
            {selected.size === 0 ? "Select students" : `Sign off ${selected.size} ${selected.size === 1 ? "student" : "students"}`}
          </Button>
          {skillIndex >= 0 && team && <CheckTypeLabel checkType={team.skills[skillIndex].checkType} />}
        </div>
      )}
    </section>
  );
}
