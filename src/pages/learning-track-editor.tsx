import { useMutation, useQuery } from "convex/react";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  FileQuestion,
  GripVertical,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
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
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useEffectiveRole } from "@/providers/role-preview-provider";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";

type TrackLevel = "intro" | "intermediate" | "advanced";

type TrackForm = {
  title: string;
  description: string;
  category: string;
  level: TrackLevel;
};

type UnitForm = {
  title: string;
  description: string;
  isRequired: boolean;
};

const emptyTrackForm: TrackForm = {
  title: "",
  description: "",
  category: "general",
  level: "intro",
};

function lessonTypeLabel(type: string) {
  if (type === "video_assignment") {
    return "Video + assignment";
  }

  if (type === "exam") {
    return "Exam";
  }

  return "Video";
}

export function LearningTrackEditorPage() {
  const navigate = useNavigate();
  const params = useParams();
  const trackId = params.trackId as Id<"trainingTracks"> | undefined;
  const viewer = useQuery(api.profiles.viewer, {});
  const effectiveRole = useEffectiveRole(viewer?.profile.role);
  const isAdmin = effectiveRole === "admin";
  const existingTrack = useQuery(
    api.training.getTrainingTrackForEdit,
    isAdmin && trackId ? { trackId } : "skip",
  );
  const saveTrackDetails = useMutation(api.training.saveTrackDetails);
  const createUnit = useMutation(api.training.createUnit);
  const updateUnit = useMutation(api.training.updateUnit);
  const reorderUnits = useMutation(api.training.reorderUnits);
  const deleteUnit = useMutation(api.training.deleteUnit);
  const createLesson = useMutation(api.training.createLesson);
  const deleteLessonFromUnit = useMutation(api.training.deleteLessonFromUnit);
  const publishLearningTrack = useMutation(api.training.publishLearningTrack);
  const [trackForm, setTrackForm] = useState<TrackForm>(emptyTrackForm);
  const [unitForms, setUnitForms] = useState<Record<string, UnitForm>>({});
  const [isSavingTrack, setIsSavingTrack] = useState(false);
  const [savingUnitId, setSavingUnitId] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [orderedUnitIds, setOrderedUnitIds] = useState<Id<"units">[]>([]);
  const [draggingUnitId, setDraggingUnitId] = useState<Id<"units"> | null>(null);

  const pageTitle = trackId ? "Edit Learning Track" : "Create a new Learning Track";
  const currentTrackId = trackId ?? existingTrack?._id;

  useEffect(() => {
    if (!existingTrack) {
      return;
    }

    // Hydrate editable form state after the record loads.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTrackForm({
      title: existingTrack.title,
      description: existingTrack.description,
      category: existingTrack.category,
      level: existingTrack.level,
    });

    const nextUnitForms: Record<string, UnitForm> = {};
    for (const unit of existingTrack.units) {
      nextUnitForms[unit._id] = {
        title: unit.title,
        description: unit.description,
        isRequired: unit.isRequired,
      };
    }

    setUnitForms(nextUnitForms);
    setOrderedUnitIds(existingTrack.units.map((unit) => unit._id));
  }, [existingTrack]);

  const orderedUnits = existingTrack
    ? orderedUnitIds
        .map((unitId) => existingTrack.units.find((unit) => unit._id === unitId))
        .filter((unit) => unit !== undefined)
    : [];

  async function ensureTrackSaved() {
    const savedTrackId = await saveTrackDetails({
      trackId,
      ...trackForm,
    });

    if (!trackId) {
      navigate(`/training/tracks/${savedTrackId}/edit`, { replace: true });
    }

    return savedTrackId;
  }

  async function handleSaveTrack(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setIsSavingTrack(true);

    try {
      await ensureTrackSaved();
      toast.success("Learning track saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save track");
    } finally {
      setIsSavingTrack(false);
    }
  }

  async function handleAddUnit() {
    setIsSavingTrack(true);

    try {
      const savedTrackId = currentTrackId ?? (await ensureTrackSaved());
      await createUnit({ trackId: savedTrackId });
      toast.success("Unit added");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to add unit");
    } finally {
      setIsSavingTrack(false);
    }
  }

  async function handleSaveUnit(unitId: Id<"units">) {
    const form = unitForms[unitId];

    if (!form) {
      return;
    }

    setSavingUnitId(unitId);

    try {
      await updateUnit({ unitId, ...form });
      toast.success("Unit saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save unit");
    } finally {
      setSavingUnitId(null);
    }
  }

  async function handleDeleteUnit(unitId: Id<"units">) {
    try {
      await deleteUnit({ unitId });
      toast.success("Unit removed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to remove unit");
    }
  }

  async function handleUnitDrop(targetUnitId: Id<"units">) {
    if (!draggingUnitId || !currentTrackId || draggingUnitId === targetUnitId) {
      setDraggingUnitId(null);
      return;
    }

    const fromIndex = orderedUnitIds.indexOf(draggingUnitId);
    const toIndex = orderedUnitIds.indexOf(targetUnitId);

    if (fromIndex === -1 || toIndex === -1) {
      setDraggingUnitId(null);
      return;
    }

    const nextUnitIds = [...orderedUnitIds];
    const [movedUnitId] = nextUnitIds.splice(fromIndex, 1);
    nextUnitIds.splice(toIndex, 0, movedUnitId);

    setOrderedUnitIds(nextUnitIds);
    setDraggingUnitId(null);

    try {
      await reorderUnits({ trackId: currentTrackId, unitIds: nextUnitIds });
      toast.success("Units reordered");
    } catch (error) {
      setOrderedUnitIds(orderedUnitIds);
      toast.error(error instanceof Error ? error.message : "Unable to reorder units");
    }
  }

  async function handleAddLesson(unitId: Id<"units">) {
    try {
      const lessonId = await createLesson({ unitId });
      toast.success("Lesson added");
      navigate(`/training/lessons/${lessonId}/edit`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to add lesson");
    }
  }

  async function handleDeleteLesson(lessonId: Id<"lessons">) {
    try {
      await deleteLessonFromUnit({ lessonId });
      toast.success("Lesson removed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to remove lesson");
    }
  }

  async function handlePublish() {
    setIsPublishing(true);

    try {
      const savedTrackId = currentTrackId ?? (await ensureTrackSaved());
      await publishLearningTrack({ trackId: savedTrackId });
      toast.success("Learning track published");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to publish track");
    } finally {
      setIsPublishing(false);
    }
  }

  if (viewer === undefined || (trackId && existingTrack === undefined)) {
    return (
      <div className="mx-auto max-w-6xl">
        <PageHeading
          eyebrow="Training"
          title={pageTitle}
          description="Loading the learning track editor."
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
          description="Only admins can create or edit learning tracks."
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

  if (trackId && existingTrack === null) {
    return (
      <div className="mx-auto max-w-6xl">
        <PageHeading
          eyebrow="Training"
          title="Learning track not found"
          description="This track may have been removed."
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
        title={pageTitle}
        description="Build the track outline here, then open each lesson to edit its video and assignment content."
        actions={
          <>
            <Badge variant={existingTrack?.isPublished ? "default" : "secondary"}>
              {existingTrack?.isPublished ? "Published" : "Draft"}
            </Badge>
            <Button
              type="button"
              onClick={handlePublish}
              disabled={isPublishing}
            >
              <CheckCircle2 className="size-4" />
              {isPublishing ? "Publishing..." : "Publish"}
            </Button>
            <Button asChild variant="outline">
              <Link to="/training">
                <ArrowLeft className="size-4" />
                Back to training
              </Link>
            </Button>
          </>
        }
      />

      <form onSubmit={handleSaveTrack} className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Track details</CardTitle>
            <CardDescription>
              Save these details before adding units to a new track.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="track-title">Title</Label>
              <Input
                id="track-title"
                value={trackForm.title}
                onChange={(event) =>
                  setTrackForm((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
                placeholder="Shop Safety"
                required
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="track-description">Description</Label>
              <Textarea
                id="track-description"
                value={trackForm.description}
                onChange={(event) =>
                  setTrackForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                placeholder="Core safety habits for working in the robotics shop."
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="track-category">Category</Label>
              <Input
                id="track-category"
                value={trackForm.category}
                onChange={(event) =>
                  setTrackForm((current) => ({
                    ...current,
                    category: event.target.value,
                  }))
                }
                placeholder="safety"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Level</Label>
              <Select
                value={trackForm.level}
                onValueChange={(value: TrackLevel) =>
                  setTrackForm((current) => ({ ...current, level: value }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="intro">Intro</SelectItem>
                  <SelectItem value="intermediate">Intermediate</SelectItem>
                  <SelectItem value="advanced">Advanced</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 md:col-span-2">
              <Button type="submit" variant="secondary" disabled={isSavingTrack}>
                <Save className="size-4" />
                {isSavingTrack ? "Saving..." : "Save track"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>

      <div className="mt-4 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Track outline</h2>
            <p className="text-sm text-muted-foreground">
              Units and lesson names are managed one item at a time.
            </p>
          </div>
          <Button onClick={handleAddUnit} disabled={isSavingTrack}>
            <Plus className="size-4" />
            Add unit
          </Button>
        </div>

        {existingTrack?.units.length === 0 && (
          <Card>
            <CardHeader>
              <CardTitle>No units yet</CardTitle>
              <CardDescription>
                Add a unit to start building this learning track.
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        {orderedUnits.map((unit, unitIndex) => {
          const form = unitForms[unit._id] ?? {
            title: unit.title,
            description: unit.description,
            isRequired: unit.isRequired,
          };

          return (
            <Card
              key={unit._id}
              draggable
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", unit._id);
                setDraggingUnitId(unit._id);
              }}
              onDragEnd={() => setDraggingUnitId(null)}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
              }}
              onDrop={(event) => {
                event.preventDefault();
                void handleUnitDrop(unit._id);
              }}
              className={draggingUnitId === unit._id ? "opacity-60" : undefined}
            >
              <CardHeader>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <GripVertical className="size-4 cursor-grab text-muted-foreground" />
                      <Badge variant="outline">Unit {unitIndex + 1}</Badge>
                      {form.isRequired && <Badge variant="secondary">Required</Badge>}
                    </div>
                    <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                      <div className="space-y-2">
                        <Label htmlFor={`${unit._id}-title`}>Unit name</Label>
                        <Input
                          id={`${unit._id}-title`}
                          value={form.title}
                          onChange={(event) =>
                            setUnitForms((current) => ({
                              ...current,
                              [unit._id]: {
                                ...form,
                                title: event.target.value,
                              },
                            }))
                          }
                        />
                      </div>
                      <div className="flex items-end gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => handleSaveUnit(unit._id)}
                          disabled={savingUnitId === unit._id}
                        >
                          <Save className="size-4" />
                          {savingUnitId === unit._id ? "Saving..." : "Save unit"}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteUnit(unit._id)}
                          aria-label="Remove unit"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`${unit._id}-description`}>Unit notes</Label>
                      <Textarea
                        id={`${unit._id}-description`}
                        value={form.description}
                        onChange={(event) =>
                          setUnitForms((current) => ({
                            ...current,
                            [unit._id]: {
                              ...form,
                              description: event.target.value,
                            },
                          }))
                        }
                        placeholder="What does this unit cover?"
                      />
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={form.isRequired}
                        onCheckedChange={(checked) =>
                          setUnitForms((current) => ({
                            ...current,
                            [unit._id]: {
                              ...form,
                              isRequired: checked === true,
                            },
                          }))
                        }
                      />
                      Required unit
                    </label>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <Separator />
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="font-medium">Lessons</h3>
                    <p className="text-sm text-muted-foreground">
                      Open a lesson to edit its video, assignment, or exam questions.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleAddLesson(unit._id)}
                  >
                    <Plus className="size-4" />
                    Add lesson
                  </Button>
                </div>

                {unit.lessons.length === 0 && (
                  <div className="rounded-md border p-4 text-sm text-muted-foreground">
                    No lessons in this unit yet.
                  </div>
                )}

                {unit.lessons.map((lesson) => (
                  <div
                    key={lesson._id}
                    className="flex flex-col gap-3 rounded-md border p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {lesson.lessonType === "exam" ? (
                          <FileQuestion className="size-4 text-primary" />
                        ) : (
                          <BookOpen className="size-4 text-primary" />
                        )}
                        <p className="font-medium">{lesson.title}</p>
                        <Badge variant="outline">
                          {lessonTypeLabel(lesson.lessonType)}
                        </Badge>
                      </div>
                      {lesson.description && (
                        <p className="mt-1 text-sm text-muted-foreground">
                          {lesson.description}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Button asChild variant="secondary" size="sm">
                        <Link to={`/training/lessons/${lesson._id}/edit`}>
                          Edit lesson
                        </Link>
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteLesson(lesson._id)}
                        aria-label="Remove lesson"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })}

        <div className="flex flex-col gap-3 rounded-md border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold">Ready for students?</h2>
            <p className="text-sm text-muted-foreground">
              Publish this track when the outline, lessons, and tests are ready.
            </p>
          </div>
          <Button
            type="button"
            onClick={handlePublish}
            disabled={isPublishing}
          >
            <CheckCircle2 className="size-4" />
            {isPublishing ? "Publishing..." : "Publish"}
          </Button>
        </div>
      </div>
    </div>
  );
}
