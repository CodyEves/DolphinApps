import { useConvexAuth } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import { ArrowLeft, Circle, CircleAlert, CircleCheck, Hourglass, Search } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

import { checkTypeMeta, groupByStage, pathColors } from "@/components/learning/learning-ui";
import type { PathColor, SkillStatus } from "@/components/learning/learning-ui";
import { PageHeading } from "@/components/page-heading";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { canReviewLearning } from "@/lib/role-access";
import { cn } from "@/lib/utils";
import { useEffectiveRole } from "@/providers/role-preview-provider";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";

function StatusCell({ status }: { status: SkillStatus }) {
  if (status === "completed") {
    return <CircleCheck className="mx-auto size-4 text-emerald-600 dark:text-emerald-400" aria-label="Done" />;
  }

  if (status === "signoff_requested") {
    return <Hourglass className="mx-auto size-4 text-amber-600 dark:text-amber-400" aria-label="Waiting for mentor" />;
  }

  if (status === "needs_work") {
    return <CircleAlert className="mx-auto size-4 text-rose-600 dark:text-rose-400" aria-label="Needs work" />;
  }

  return <Circle className="mx-auto size-3 text-muted-foreground/40" aria-label="Not started" />;
}

export function LearningTeamPage() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const viewer = useQuery(api.profiles.viewer, isAuthenticated ? {} : "skip");
  const role = useEffectiveRole(viewer?.profile.role);
  const isReviewer = canReviewLearning(role);
  const content = useQuery(api.learning.myLearning, isAuthenticated && isReviewer ? {} : "skip");
  const [pathId, setPathId] = useState<Id<"learningPaths"> | "">("");
  const [program, setProgram] = useState<"all" | "frc_5199" | "frc_9271">("all");
  const [search, setSearch] = useState("");
  const paths = content?.paths ?? [];
  const activePathId = pathId || paths[0]?._id || "";
  const team = useQuery(api.learning.teamProgress, isReviewer && activePathId ? { pathId: activePathId } : "skip");
  const stages = team ? groupByStage(team.skills.map((skill, index) => ({ ...skill, index }))) : [];
  const students = (team?.students ?? []).filter(
    (student) =>
      (program === "all" || student.program === program) &&
      student.name.toLowerCase().includes(search.trim().toLowerCase()),
  );
  const palette = team ? pathColors[team.path.color as PathColor] : pathColors.blue;

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeading
        eyebrow="Learning"
        title="Team progress"
        description="See where every student is in each path. Use it to plan who needs help in the next class."
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
            <CardDescription>Only mentors, instructors, and admins can see team progress.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-wrap gap-2" role="tablist" aria-label="Paths">
              {paths.map((path) => (
                <Button
                  key={path._id}
                  role="tab"
                  aria-selected={path._id === activePathId}
                  variant={path._id === activePathId ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPathId(path._id)}
                >
                  {path.title}
                </Button>
              ))}
            </div>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <select
                aria-label="Team"
                className="h-8 rounded-md border bg-card px-2 text-sm"
                value={program}
                onChange={(event) => setProgram(event.target.value as typeof program)}
              >
                <option value="all">Both teams</option>
                <option value="frc_5199">5199</option>
                <option value="frc_9271">9271</option>
              </select>
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input
                  aria-label="Find a student"
                  placeholder="Find a student"
                  className="h-8 w-44 pl-8 text-sm"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1"><CircleCheck className="size-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden /> Done</span>
            <span className="inline-flex items-center gap-1"><Hourglass className="size-3.5 text-amber-600 dark:text-amber-400" aria-hidden /> Waiting for mentor</span>
            <span className="inline-flex items-center gap-1"><CircleAlert className="size-3.5 text-rose-600 dark:text-rose-400" aria-hidden /> Needs work</span>
            <span className="inline-flex items-center gap-1"><Circle className="size-3 text-muted-foreground/40" aria-hidden /> Not started</span>
            <span>Hover a column number to see the skill.</span>
          </div>

          {team === undefined ? (
            <p className="text-sm text-muted-foreground">{paths.length === 0 && content ? "No paths yet." : "Loading progress…"}</p>
          ) : team === null ? (
            <p className="text-sm text-muted-foreground">That path no longer exists.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border bg-card">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b">
                    <th scope="col" rowSpan={2} className="sticky left-0 z-10 min-w-44 bg-card px-3 py-2 text-left align-bottom font-semibold">
                      Student
                    </th>
                    <th scope="col" rowSpan={2} className="px-2 py-2 text-right align-bottom font-semibold whitespace-nowrap">
                      Done
                    </th>
                    {stages.map((group) => (
                      <th key={group.stage} scope="colgroup" colSpan={group.items.length} className={cn("border-l px-2 py-1.5 text-left text-xs font-semibold whitespace-nowrap", palette.text)}>
                        {group.stage}
                      </th>
                    ))}
                  </tr>
                  <tr className="border-b">
                    {stages.flatMap((group) =>
                      group.items.map((skill, indexInStage) => (
                        <th
                          key={skill._id}
                          scope="col"
                          title={`${skill.title} (${checkTypeMeta[skill.checkType].label})`}
                          className={cn("w-9 px-1 py-1 text-center text-xs font-medium text-muted-foreground tabular-nums", indexInStage === 0 && "border-l")}
                        >
                          <Link to={`/training/skills/${skill._id}`} className="hover:text-foreground">
                            {skill.index + 1}
                          </Link>
                        </th>
                      )),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {students.length === 0 ? (
                    <tr>
                      <td colSpan={team.skills.length + 2} className="px-3 py-6 text-center text-muted-foreground">
                        No students match.
                      </td>
                    </tr>
                  ) : (
                    students.map((student) => {
                      const done = student.statuses.filter((status) => status === "completed").length;

                      return (
                        <tr key={student.userId} className="border-b last:border-b-0 hover:bg-accent/50">
                          <th scope="row" className="sticky left-0 z-10 max-w-56 truncate bg-card px-3 py-1.5 text-left font-medium">
                            {student.name}
                          </th>
                          <td className="px-2 py-1.5 text-right text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                            {done}/{team.skills.length}
                          </td>
                          {stages.flatMap((group) =>
                            group.items.map((skill, indexInStage) => (
                              <td key={skill._id} className={cn("px-1 py-1.5 text-center", indexInStage === 0 && "border-l")}>
                                <StatusCell status={student.statuses[skill.index]} />
                              </td>
                            )),
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
