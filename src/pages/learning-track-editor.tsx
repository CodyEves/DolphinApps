import { useConvexAuth } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Plus,
  Save,
  Trash2,
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
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";

type TrackLevel = "intro" | "intermediate" | "advanced";
type LessonType = "video" | "reading" | "exercise";

type LessonForm = {
  clientId: string;
  id?: Id<"lessons">;
  title: string;
  description: string;
  lessonType: LessonType;
  youtubeUrl: string;
  estimatedMinutes: string;
  required: boolean;
};

type UnitForm = {
  clientId: string;
  id?: Id<"units">;
  title: string;
  description: string;
  isRequired: boolean;
  lessons: LessonForm[];
};

type TrackForm = {
  title: string;
  description: string;
  category: string;
  level: TrackLevel;
  units: UnitForm[];
};

function createClientId() {
  return crypto.randomUUID();
}

function createLesson(): LessonForm {
  return {
    clientId: createClientId(),
    title: "",
    description: "",
    lessonType: "video",
    youtubeUrl: "",
    estimatedMinutes: "15",
    required: true,
  };
}

function createUnit(): UnitForm {
  return {
    clientId: createClientId(),
    title: "",
    description: "",
    isRequired: true,
    lessons: [createLesson()],
  };
}

function createEmptyTrackForm(): TrackForm {
  return {
    title: "",
    description: "",
    category: "general",
    level: "intro",
    units: [createUnit()],
  };
}

export function LearningTrackEditorPage() {
  const { isAuthenticated } = useConvexAuth();
  const navigate = useNavigate();
  const params = useParams();
  const trackId = params.trackId as Id<"trainingTracks"> | undefined;
  const viewer = useQuery(api.profiles.viewer, isAuthenticated ? {} : "skip");
  const existingTrack = useQuery(
    api.training.getTrainingTrackForEdit,
    isAuthenticated && trackId ? { trackId } : "skip",
  );
  const saveLearningTrackDraft = useMutation(api.training.saveLearningTrackDraft);
  const publishLearningTrack = useMutation(api.training.publishLearningTrack);
  const [form, setForm] = useState<TrackForm>(() => createEmptyTrackForm());
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  const isAdmin = viewer?.profile.role === "admin";
  const pageTitle = trackId ? "Edit Learning Track" : "Create a new Learning Track";
  const statusLabel = existingTrack?.isPublished ? "Published" : "Draft";

  useEffect(() => {
    if (!existingTrack) {
      return;
    }

    // Hydrate editable form state after the Convex record loads.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm({
      title: existingTrack.title,
      description: existingTrack.description,
      category: existingTrack.category,
      level: existingTrack.level,
      units: existingTrack.units.map((unit) => ({
        clientId: unit._id,
        id: unit._id,
        title: unit.title,
        description: unit.description,
        isRequired: unit.isRequired,
        lessons: unit.lessons.map((lesson) => ({
          clientId: lesson._id,
          id: lesson._id,
          title: lesson.title,
          description: lesson.description,
          lessonType: lesson.lessonType,
          youtubeUrl: lesson.youtubeUrl ?? "",
          estimatedMinutes: String(lesson.estimatedMinutes),
          required: lesson.required,
        })),
      })),
    });
  }, [existingTrack]);

  const hasPublishableContent = useMemo(
    () => form.units.length > 0 && form.units.some((unit) => unit.lessons.length > 0),
    [form.units],
  );

  function updateUnit(unitClientId: string, patch: Partial<UnitForm>) {
    setForm((current) => ({
      ...current,
      units: current.units.map((unit) =>
        unit.clientId === unitClientId ? { ...unit, ...patch } : unit,
      ),
    }));
  }

  function updateLesson(
    unitClientId: string,
    lessonClientId: string,
    patch: Partial<LessonForm>,
  ) {
    setForm((current) => ({
      ...current,
      units: current.units.map((unit) =>
        unit.clientId === unitClientId
          ? {
              ...unit,
              lessons: unit.lessons.map((lesson) =>
                lesson.clientId === lessonClientId
                  ? { ...lesson, ...patch }
                  : lesson,
              ),
            }
          : unit,
      ),
    }));
  }

  function addUnit() {
    setForm((current) => ({
      ...current,
      units: [...current.units, createUnit()],
    }));
  }

  function removeUnit(unitClientId: string) {
    setForm((current) => ({
      ...current,
      units: current.units.filter((unit) => unit.clientId !== unitClientId),
    }));
  }

  function addLesson(unitClientId: string) {
    setForm((current) => ({
      ...current,
      units: current.units.map((unit) =>
        unit.clientId === unitClientId
          ? { ...unit, lessons: [...unit.lessons, createLesson()] }
          : unit,
      ),
    }));
  }

  function removeLesson(unitClientId: string, lessonClientId: string) {
    setForm((current) => ({
      ...current,
      units: current.units.map((unit) =>
        unit.clientId === unitClientId
          ? {
              ...unit,
              lessons: unit.lessons.filter(
                (lesson) => lesson.clientId !== lessonClientId,
              ),
            }
          : unit,
      ),
    }));
  }

  function serializeForm() {
    return {
      trackId,
      title: form.title,
      description: form.description,
      category: form.category,
      level: form.level,
      units: form.units.map((unit) => ({
        id: unit.id,
        title: unit.title,
        description: unit.description,
        isRequired: unit.isRequired,
        lessons: unit.lessons.map((lesson) => ({
          id: lesson.id,
          title: lesson.title,
          description: lesson.description,
          lessonType: lesson.lessonType,
          youtubeUrl: lesson.youtubeUrl.trim() || undefined,
          estimatedMinutes: Number(lesson.estimatedMinutes),
          required: lesson.required,
        })),
      })),
    };
  }

  async function handleSave(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setIsSaving(true);

    try {
      const savedTrackId = await saveLearningTrackDraft(serializeForm());
      toast.success("Learning track draft saved");

      if (!trackId) {
        navigate(`/training/tracks/${savedTrackId}/edit`, { replace: true });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save track");
    } finally {
      setIsSaving(false);
    }
  }

  async function handlePublish() {
    setIsPublishing(true);

    try {
      const savedTrackId = await saveLearningTrackDraft(serializeForm());
      await publishLearningTrack({ trackId: savedTrackId });
      toast.success("Learning track published");

      if (!trackId) {
        navigate(`/training/tracks/${savedTrackId}/edit`, { replace: true });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to publish track");
    } finally {
      setIsPublishing(false);
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-6xl">
        <PageHeading
          eyebrow="Training"
          title="Create a new Learning Track"
          description="Sign in with an admin account to create learning tracks."
        />
        <Card>
          <CardHeader>
            <CardTitle>Sign in required</CardTitle>
            <CardDescription>
              Learning track creation is only available to admins.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
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
        <Card>
          <CardHeader>
            <CardTitle>Learning track editor is restricted</CardTitle>
            <CardDescription>
              Ask an admin to update your role if you need access to this page.
            </CardDescription>
          </CardHeader>
        </Card>
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
        description="Create the ordered units and lessons students will follow."
        actions={
          <>
            <Badge variant={existingTrack?.isPublished ? "default" : "secondary"}>
              {statusLabel}
            </Badge>
            <Button asChild variant="outline">
              <Link to="/training">
                <ArrowLeft className="size-4" />
                Back to training
              </Link>
            </Button>
          </>
        }
      />

      <form onSubmit={handleSave} className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Track details</CardTitle>
            <CardDescription>
              This information appears in the Training track list.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="track-title">Title</Label>
              <Input
                id="track-title"
                value={form.title}
                onChange={(event) =>
                  setForm((current) => ({ ...current, title: event.target.value }))
                }
                placeholder="Shop Safety"
                required
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="track-description">Description</Label>
              <Textarea
                id="track-description"
                value={form.description}
                onChange={(event) =>
                  setForm((current) => ({
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
                value={form.category}
                onChange={(event) =>
                  setForm((current) => ({
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
                value={form.level}
                onValueChange={(value: TrackLevel) =>
                  setForm((current) => ({ ...current, level: value }))
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
          </CardContent>
        </Card>

        <div className="space-y-4">
          {form.units.map((unit, unitIndex) => (
            <Card key={unit.clientId}>
              <CardHeader>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <CardTitle>Unit {unitIndex + 1}</CardTitle>
                    <CardDescription>
                      Group related lessons into a clear pathway section.
                    </CardDescription>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeUnit(unit.clientId)}
                    disabled={form.units.length === 1}
                  >
                    <Trash2 className="size-4" />
                    Remove unit
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor={`${unit.clientId}-title`}>Title</Label>
                    <Input
                      id={`${unit.clientId}-title`}
                      value={unit.title}
                      onChange={(event) =>
                        updateUnit(unit.clientId, { title: event.target.value })
                      }
                      placeholder="Hand Tool Safety"
                      required
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor={`${unit.clientId}-description`}>
                      Description
                    </Label>
                    <Textarea
                      id={`${unit.clientId}-description`}
                      value={unit.description}
                      onChange={(event) =>
                        updateUnit(unit.clientId, {
                          description: event.target.value,
                        })
                      }
                      placeholder="Safe tool handling, PPE, cleanup, and mentor expectations."
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={unit.isRequired}
                      onCheckedChange={(checked) =>
                        updateUnit(unit.clientId, { isRequired: checked === true })
                      }
                    />
                    Required unit
                  </label>
                </div>

                <Separator />

                <div className="space-y-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="font-medium">Lessons</h2>
                      <p className="text-sm text-muted-foreground">
                        Lessons are shown in the order listed here.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => addLesson(unit.clientId)}
                    >
                      <Plus className="size-4" />
                      Add lesson
                    </Button>
                  </div>

                  {unit.lessons.map((lesson, lessonIndex) => (
                    <div key={lesson.clientId} className="rounded-md border p-4">
                      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-2">
                          <BookOpen className="size-4 text-primary" />
                          <h3 className="font-medium">Lesson {lessonIndex + 1}</h3>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            removeLesson(unit.clientId, lesson.clientId)
                          }
                          disabled={unit.lessons.length === 1}
                        >
                          <Trash2 className="size-4" />
                          Remove lesson
                        </Button>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2 md:col-span-2">
                          <Label htmlFor={`${lesson.clientId}-title`}>Title</Label>
                          <Input
                            id={`${lesson.clientId}-title`}
                            value={lesson.title}
                            onChange={(event) =>
                              updateLesson(unit.clientId, lesson.clientId, {
                                title: event.target.value,
                              })
                            }
                            placeholder="Shop orientation"
                            required
                          />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                          <Label htmlFor={`${lesson.clientId}-description`}>
                            Description
                          </Label>
                          <Textarea
                            id={`${lesson.clientId}-description`}
                            value={lesson.description}
                            onChange={(event) =>
                              updateLesson(unit.clientId, lesson.clientId, {
                                description: event.target.value,
                              })
                            }
                            placeholder="Learn where tools, PPE, first aid, and exits are located."
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Lesson type</Label>
                          <Select
                            value={lesson.lessonType}
                            onValueChange={(value: LessonType) =>
                              updateLesson(unit.clientId, lesson.clientId, {
                                lessonType: value,
                              })
                            }
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="video">Video</SelectItem>
                              <SelectItem value="reading">Reading</SelectItem>
                              <SelectItem value="exercise">Exercise</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`${lesson.clientId}-minutes`}>
                            Estimated minutes
                          </Label>
                          <Input
                            id={`${lesson.clientId}-minutes`}
                            type="number"
                            min={1}
                            value={lesson.estimatedMinutes}
                            onChange={(event) =>
                              updateLesson(unit.clientId, lesson.clientId, {
                                estimatedMinutes: event.target.value,
                              })
                            }
                            required
                          />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                          <Label htmlFor={`${lesson.clientId}-youtube`}>
                            YouTube URL
                          </Label>
                          <Input
                            id={`${lesson.clientId}-youtube`}
                            type="url"
                            value={lesson.youtubeUrl}
                            onChange={(event) =>
                              updateLesson(unit.clientId, lesson.clientId, {
                                youtubeUrl: event.target.value,
                              })
                            }
                            placeholder="https://www.youtube.com/watch?v=..."
                          />
                        </div>
                        <label className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={lesson.required}
                            onCheckedChange={(checked) =>
                              updateLesson(unit.clientId, lesson.clientId, {
                                required: checked === true,
                              })
                            }
                          />
                          Required lesson
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Button type="button" variant="outline" onClick={addUnit}>
            <Plus className="size-4" />
            Add unit
          </Button>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button type="submit" variant="secondary" disabled={isSaving}>
              <Save className="size-4" />
              {isSaving ? "Saving..." : "Save draft"}
            </Button>
            <Button
              type="button"
              onClick={handlePublish}
              disabled={isPublishing || !hasPublishableContent}
            >
              <CheckCircle2 className="size-4" />
              {isPublishing ? "Publishing..." : "Publish"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
