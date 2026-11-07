import { useConvexAuth } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import { ArrowLeft, ChevronDown, ChevronUp, Download, Eye, EyeOff, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useSearchParams } from "react-router";
import { toast } from "sonner";

import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { CheckTypeLabel, checkTypeMeta, pathColors, resourceKindMeta } from "@/components/learning/learning-ui";
import type { CheckType, PathColor, ResourceKind } from "@/components/learning/learning-ui";
import { PageHeading } from "@/components/page-heading";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { api } from "@convex/_generated/api";
import type { Doc, Id } from "@convex/_generated/dataModel";

function errorText(error: unknown, fallback: string) {
  return error instanceof Error ? error.message.replace(/^.*Uncaught Error: /, "").split("\n")[0] : fallback;
}

type ManagedPath = Doc<"learningPaths"> & { skills: Doc<"learningSkills">[] };

const selectClass = "h-9 w-full rounded-md border bg-card px-3 text-sm";

export function LearningManagePage() {
  const { isAuthenticated } = useConvexAuth();
  const myLearning = useQuery(api.learning.myLearning, isAuthenticated ? {} : "skip");
  const canEdit = myLearning?.canEdit ?? false;
  const content = useQuery(api.learning.manageContent, canEdit ? {} : "skip");
  const loadStarterContent = useMutation(api.learning.loadStarterContent);
  const [searchParams, setSearchParams] = useSearchParams();
  const [newSkillPathId, setNewSkillPathId] = useState<Id<"learningPaths"> | null>(null);
  const [isSeeding, setIsSeeding] = useState(false);
  const editingSkillId = searchParams.get("skill");
  const editingSkill = content?.flatMap((path) => path.skills).find((skill) => skill._id === editingSkillId) ?? null;
  const sheetOpen = !!editingSkill || !!newSkillPathId;

  function closeEditor() {
    setNewSkillPathId(null);

    if (searchParams.has("skill")) {
      searchParams.delete("skill");
      setSearchParams(searchParams, { replace: true });
    }
  }

  function openSkill(skillId: Id<"learningSkills">) {
    setNewSkillPathId(null);
    setSearchParams({ skill: skillId }, { replace: true });
  }

  async function handleSeed() {
    setIsSeeding(true);

    try {
      const result = await loadStarterContent({});
      toast.success(
        result.pathsAdded + result.skillsAdded === 0
          ? "Everything from the starter set is already here"
          : `Added ${result.pathsAdded} paths and ${result.skillsAdded} skills`,
      );
    } catch (error) {
      toast.error(errorText(error, "Couldn't load the starter skills"));
    } finally {
      setIsSeeding(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeading
        eyebrow="Learning"
        title="Edit skills"
        description="Change what students see: paths, skills, resource links, quizzes, and how each skill is checked."
        actions={
          <>
            <Button asChild variant="outline">
              <Link to="/training">
                <ArrowLeft className="size-4" />
                Learning
              </Link>
            </Button>
            {canEdit && (
              <Button variant="outline" onClick={handleSeed} disabled={isSeeding}>
                <Download className="size-4" />
                {isSeeding ? "Loading…" : "Add starter skills"}
              </Button>
            )}
          </>
        }
      />

      {myLearning !== undefined && !canEdit ? (
        <Card className="border-dashed">
          <CardHeader className="items-center text-center">
            <CardTitle>Mentors only</CardTitle>
            <CardDescription>Only mentors, instructors, leads, and admins can edit learning content.</CardDescription>
          </CardHeader>
        </Card>
      ) : content === undefined ? (
        <p className="text-sm text-muted-foreground">Loading content…</p>
      ) : (
        <div className="space-y-8">
          {content.length === 0 && (
            <p className="text-sm text-muted-foreground">No paths yet. Use “Add starter skills” to load the pre-season objectives, or create a path below.</p>
          )}
          {content.map((path) => (
            <PathSection key={path._id} path={path} onEditSkill={openSkill} onAddSkill={() => setNewSkillPathId(path._id)} />
          ))}
          <NewPathForm />
        </div>
      )}

      <Sheet open={sheetOpen} onOpenChange={(open) => !open && closeEditor()}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          {sheetOpen && content && (
            <SkillEditor
              key={editingSkill?._id ?? `new-${newSkillPathId}`}
              skill={editingSkill}
              defaultPathId={editingSkill?.pathId ?? newSkillPathId!}
              paths={content}
              onDone={closeEditor}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function PathSection({
  path,
  onEditSkill,
  onAddSkill,
}: {
  path: ManagedPath;
  onEditSkill: (skillId: Id<"learningSkills">) => void;
  onAddSkill: () => void;
}) {
  const moveSkill = useMutation(api.learning.moveSkill);
  const deleteSkill = useMutation(api.learning.deleteSkill);
  const [isEditingPath, setIsEditingPath] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Doc<"learningSkills"> | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const palette = pathColors[path.color as PathColor];

  async function handleDelete() {
    if (!pendingDelete) {
      return;
    }

    setIsDeleting(true);

    try {
      await deleteSkill({ skillId: pendingDelete._id });
      toast.success("Skill deleted");
      setPendingDelete(null);
    } catch (error) {
      toast.error(errorText(error, "Couldn't delete the skill"));
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <span className={cn("size-2.5 rounded-full", palette.dot)} aria-hidden />
            {path.title}
            {!path.isPublished && <span className="text-xs font-normal text-muted-foreground">Hidden</span>}
          </h2>
          <p className="max-w-[65ch] text-sm text-muted-foreground">{path.summary}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setIsEditingPath((value) => !value)}>
            <Pencil className="size-4" />
            {isEditingPath ? "Close" : "Edit path"}
          </Button>
          <Button size="sm" onClick={onAddSkill}>
            <Plus className="size-4" />
            Add skill
          </Button>
        </div>
      </div>

      {isEditingPath && <PathForm path={path} onDone={() => setIsEditingPath(false)} />}

      {path.skills.length === 0 ? (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No skills in this path yet.</p>
      ) : (
        <ul className="divide-y overflow-hidden rounded-lg border bg-card">
          {path.skills.map((skill, index) => (
            <li key={skill._id} className="flex items-center gap-2 px-3 py-2">
              <div className="flex flex-col">
                <Button variant="ghost" size="icon" className="size-6" aria-label="Move up" disabled={index === 0} onClick={() => moveSkill({ skillId: skill._id, direction: "up" })}>
                  <ChevronUp className="size-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="size-6" aria-label="Move down" disabled={index === path.skills.length - 1} onClick={() => moveSkill({ skillId: skill._id, direction: "down" })}>
                  <ChevronDown className="size-3.5" />
                </Button>
              </div>
              <button type="button" onClick={() => onEditSkill(skill._id)} className="min-w-0 flex-1 rounded-md px-2 py-1 text-left hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none">
                <span className="block truncate text-sm font-medium">{skill.title}</span>
                <span className="flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                  <span>{skill.stage}</span>
                  <CheckTypeLabel checkType={skill.checkType} />
                  <span>{skill.resources.length} links</span>
                  {skill.checkType === "quiz" && <span>{skill.quiz?.length ?? 0} questions</span>}
                  {!skill.isPublished && (
                    <span className="inline-flex items-center gap-1">
                      <EyeOff className="size-3" aria-hidden /> Hidden
                    </span>
                  )}
                </span>
              </button>
              <Button variant="ghost" size="icon" aria-label={`Delete ${skill.title}`} onClick={() => setPendingDelete(skill)}>
                <Trash2 className="size-4 text-muted-foreground" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDeleteDialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="Delete this skill?"
        itemName={pendingDelete?.stage ?? ""}
        itemType="stage name"
        description="This removes the skill and every student's progress on it. To keep progress, hide the skill instead."
        isDeleting={isDeleting}
        onConfirm={handleDelete}
      />
    </section>
  );
}

function PathForm({ path, onDone }: { path?: ManagedPath; onDone?: () => void }) {
  const savePath = useMutation(api.learning.savePath);
  const [title, setTitle] = useState(path?.title ?? "");
  const [summary, setSummary] = useState(path?.summary ?? "");
  const [color, setColor] = useState<PathColor>((path?.color as PathColor) ?? "teal");
  const [isPublished, setIsPublished] = useState(path?.isPublished ?? true);
  const [isSaving, setIsSaving] = useState(false);
  const idPrefix = path?._id ?? "new-path";

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setIsSaving(true);

    try {
      await savePath({ pathId: path?._id, title, summary, color, isPublished });
      toast.success(path ? "Path saved" : "Path created");

      if (!path) {
        setTitle("");
        setSummary("");
      }

      onDone?.();
    } catch (error) {
      toast.error(errorText(error, "Couldn't save the path"));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-title`}>Path name</Label>
        <Input id={`${idPrefix}-title`} value={title} onChange={(event) => setTitle(event.target.value)} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-color`}>Color</Label>
        <select id={`${idPrefix}-color`} className={selectClass} value={color} onChange={(event) => setColor(event.target.value as PathColor)}>
          {(Object.keys(pathColors) as PathColor[]).map((key) => (
            <option key={key} value={key}>
              {pathColors[key].label}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor={`${idPrefix}-summary`}>Summary</Label>
        <Textarea id={`${idPrefix}-summary`} value={summary} onChange={(event) => setSummary(event.target.value)} rows={2} required />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={isPublished} onChange={(event) => setIsPublished(event.target.checked)} />
        Visible to students
      </label>
      <div className="flex justify-end">
        <Button type="submit" disabled={isSaving}>
          {path ? "Save path" : "Create path"}
        </Button>
      </div>
    </form>
  );
}

function NewPathForm() {
  const [isOpen, setIsOpen] = useState(false);

  return isOpen ? (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">New path</h2>
      <PathForm onDone={() => setIsOpen(false)} />
    </section>
  ) : (
    <Button variant="outline" onClick={() => setIsOpen(true)}>
      <Plus className="size-4" />
      New path
    </Button>
  );
}

type ResourceDraft = { title: string; url: string; kind: ResourceKind; source: string; minutes: string };
type QuestionDraft = { prompt: string; options: string[]; correctIndex: number; explanation: string };

function SkillEditor({
  skill,
  defaultPathId,
  paths,
  onDone,
}: {
  skill: Doc<"learningSkills"> | null;
  defaultPathId: Id<"learningPaths">;
  paths: ManagedPath[];
  onDone: () => void;
}) {
  const saveSkill = useMutation(api.learning.saveSkill);
  const [pathId, setPathId] = useState<Id<"learningPaths">>(defaultPathId);
  const [stage, setStage] = useState(skill?.stage ?? "");
  const [title, setTitle] = useState(skill?.title ?? "I can ");
  const [successCriteria, setSuccessCriteria] = useState(skill?.successCriteria ?? "");
  const [practice, setPractice] = useState(skill?.practice ?? "");
  const [checkType, setCheckType] = useState<CheckType>(skill?.checkType ?? "self");
  const [estimatedMinutes, setEstimatedMinutes] = useState(String(skill?.estimatedMinutes ?? 30));
  const [passPercent, setPassPercent] = useState(String(skill?.passPercent ?? 80));
  const [isPublished, setIsPublished] = useState(skill?.isPublished ?? true);
  const [resources, setResources] = useState<ResourceDraft[]>(
    skill?.resources.map((resource) => ({
      title: resource.title,
      url: resource.url,
      kind: resource.kind as ResourceKind,
      source: resource.source,
      minutes: resource.minutes ? String(resource.minutes) : "",
    })) ?? [],
  );
  const [questions, setQuestions] = useState<QuestionDraft[]>(
    skill?.quiz?.map((question) => ({
      prompt: question.prompt,
      options: question.options,
      correctIndex: question.correctIndex,
      explanation: question.explanation ?? "",
    })) ?? [],
  );
  const [isSaving, setIsSaving] = useState(false);
  const stageOptions = [...new Set(paths.find((path) => path._id === pathId)?.skills.map((item) => item.stage) ?? [])];

  function updateResource(index: number, patch: Partial<ResourceDraft>) {
    setResources((current) => current.map((resource, i) => (i === index ? { ...resource, ...patch } : resource)));
  }

  function updateQuestion(index: number, patch: Partial<QuestionDraft>) {
    setQuestions((current) => current.map((question, i) => (i === index ? { ...question, ...patch } : question)));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setIsSaving(true);

    try {
      await saveSkill({
        skillId: skill?._id,
        pathId,
        stage,
        title,
        successCriteria,
        practice: practice || undefined,
        checkType,
        estimatedMinutes: Number(estimatedMinutes) || 30,
        isPublished,
        passPercent: checkType === "quiz" ? Number(passPercent) || 80 : undefined,
        resources: resources
          .filter((resource) => resource.title.trim() || resource.url.trim())
          .map((resource) => ({
            title: resource.title,
            url: resource.url,
            kind: resource.kind,
            source: resource.source || "Team",
            minutes: resource.minutes ? Number(resource.minutes) : undefined,
          })),
        quiz:
          checkType === "quiz"
            ? questions.map((question) => ({
                prompt: question.prompt,
                options: question.options,
                correctIndex: question.correctIndex,
                explanation: question.explanation || undefined,
              }))
            : undefined,
      });
      toast.success(skill ? "Skill saved" : "Skill added");
      onDone();
    } catch (error) {
      toast.error(errorText(error, "Couldn't save the skill"));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 px-4 pb-6">
      <SheetHeader className="px-0">
        <SheetTitle>{skill ? "Edit skill" : "New skill"}</SheetTitle>
        <SheetDescription>Write the skill as something a student can do, starting with “I can”.</SheetDescription>
      </SheetHeader>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="skill-path">Path</Label>
          <select id="skill-path" className={selectClass} value={pathId} onChange={(event) => setPathId(event.target.value as Id<"learningPaths">)}>
            {paths.map((path) => (
              <option key={path._id} value={path._id}>
                {path.title}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="skill-stage">Stage</Label>
          <Input id="skill-stage" list="skill-stage-options" value={stage} onChange={(event) => setStage(event.target.value)} required />
          <datalist id="skill-stage-options">
            {stageOptions.map((option) => (
              <option key={option} value={option} />
            ))}
          </datalist>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="skill-title">Skill</Label>
        <Textarea id="skill-title" value={title} onChange={(event) => setTitle(event.target.value)} rows={2} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="skill-success">Success looks like</Label>
        <Textarea id="skill-success" value={successCriteria} onChange={(event) => setSuccessCriteria(event.target.value)} rows={2} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="skill-practice">Try it (practice task)</Label>
        <Textarea id="skill-practice" value={practice} onChange={(event) => setPractice(event.target.value)} rows={3} />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="skill-check">How it's checked</Label>
          <select id="skill-check" className={selectClass} value={checkType} onChange={(event) => setCheckType(event.target.value as CheckType)}>
            {(Object.keys(checkTypeMeta) as CheckType[]).map((key) => (
              <option key={key} value={key}>
                {checkTypeMeta[key].label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="skill-minutes">Minutes</Label>
          <Input id="skill-minutes" type="number" min={5} step={5} value={estimatedMinutes} onChange={(event) => setEstimatedMinutes(event.target.value)} />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={isPublished} onChange={(event) => setIsPublished(event.target.checked)} />
        <Eye className="size-4 text-muted-foreground" aria-hidden />
        Visible to students
      </label>

      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold">Resource links</legend>
        {resources.map((resource, index) => (
          <div key={index} className="grid gap-2 rounded-md border p-3 sm:grid-cols-2">
            <Input aria-label="Resource title" placeholder="Title" value={resource.title} onChange={(event) => updateResource(index, { title: event.target.value })} />
            <Input aria-label="Resource link" type="url" placeholder="https://…" value={resource.url} onChange={(event) => updateResource(index, { url: event.target.value })} />
            <Input aria-label="Resource source" placeholder="Source, e.g. Spectrum 3847" value={resource.source} onChange={(event) => updateResource(index, { source: event.target.value })} />
            <div className="flex gap-2">
              <select aria-label="Resource type" className={selectClass} value={resource.kind} onChange={(event) => updateResource(index, { kind: event.target.value as ResourceKind })}>
                {(Object.keys(resourceKindMeta) as ResourceKind[]).map((key) => (
                  <option key={key} value={key}>
                    {resourceKindMeta[key].label}
                  </option>
                ))}
              </select>
              <Input aria-label="Resource minutes" type="number" min={1} placeholder="min" className="w-20" value={resource.minutes} onChange={(event) => updateResource(index, { minutes: event.target.value })} />
              <Button type="button" variant="ghost" size="icon" aria-label="Remove link" onClick={() => setResources((current) => current.filter((_, i) => i !== index))}>
                <Trash2 className="size-4" />
              </Button>
            </div>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setResources((current) => [...current, { title: "", url: "", kind: "video", source: "", minutes: "" }])}
        >
          <Plus className="size-4" />
          Add link
        </Button>
      </fieldset>

      {checkType === "quiz" && (
        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold">Quiz</legend>
          <div className="flex items-center gap-2 text-sm">
            <Label htmlFor="skill-pass">Pass with</Label>
            <Input id="skill-pass" type="number" min={1} max={100} className="w-20" value={passPercent} onChange={(event) => setPassPercent(event.target.value)} />
            <span>%</span>
          </div>
          {questions.map((question, questionIndex) => (
            <div key={questionIndex} className="space-y-2 rounded-md border p-3">
              <div className="flex items-start gap-2">
                <Textarea
                  aria-label={`Question ${questionIndex + 1}`}
                  placeholder={`Question ${questionIndex + 1}`}
                  rows={2}
                  value={question.prompt}
                  onChange={(event) => updateQuestion(questionIndex, { prompt: event.target.value })}
                />
                <Button type="button" variant="ghost" size="icon" aria-label="Remove question" onClick={() => setQuestions((current) => current.filter((_, i) => i !== questionIndex))}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Select the correct answer.</p>
              {question.options.map((option, optionIndex) => (
                <div key={optionIndex} className="flex items-center gap-2">
                  <input
                    type="radio"
                    aria-label={`Answer ${optionIndex + 1} is correct`}
                    name={`correct-${questionIndex}`}
                    className="size-4 accent-[var(--primary)]"
                    checked={question.correctIndex === optionIndex}
                    onChange={() => updateQuestion(questionIndex, { correctIndex: optionIndex })}
                  />
                  <Input
                    aria-label={`Answer ${optionIndex + 1}`}
                    placeholder={`Answer ${optionIndex + 1}`}
                    value={option}
                    onChange={(event) =>
                      updateQuestion(questionIndex, {
                        options: question.options.map((value, i) => (i === optionIndex ? event.target.value : value)),
                      })
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Remove answer"
                    disabled={question.options.length <= 2}
                    onClick={() =>
                      updateQuestion(questionIndex, {
                        options: question.options.filter((_, i) => i !== optionIndex),
                        correctIndex:
                          question.correctIndex === optionIndex
                            ? 0
                            : question.correctIndex > optionIndex
                              ? question.correctIndex - 1
                              : question.correctIndex,
                      })
                    }
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="ghost" size="sm" onClick={() => updateQuestion(questionIndex, { options: [...question.options, ""] })}>
                <Plus className="size-4" />
                Add answer
              </Button>
              <Input
                aria-label="Explanation shown after answering"
                placeholder="Explanation shown after answering (optional)"
                value={question.explanation}
                onChange={(event) => updateQuestion(questionIndex, { explanation: event.target.value })}
              />
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setQuestions((current) => [...current, { prompt: "", options: ["", ""], correctIndex: 0, explanation: "" }])}
          >
            <Plus className="size-4" />
            Add question
          </Button>
        </fieldset>
      )}

      <div className="flex justify-end gap-2 border-t pt-4">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSaving}>
          {isSaving ? "Saving…" : skill ? "Save skill" : "Add skill"}
        </Button>
      </div>
    </form>
  );
}
