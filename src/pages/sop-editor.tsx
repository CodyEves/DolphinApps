import { useConvexAuth } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  ImagePlus,
  Plus,
  Save,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { toast } from "sonner";

import { PageHeading } from "@/components/page-heading";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";

type StepDraft = {
  title: string;
  detail: string;
  imageStorageId?: Id<"_storage">;
  imageUrl?: string | null;
};

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/**
 * Multi-line textareas back the list fields: one item per line is far faster to author
 * than a row of inputs with add/remove buttons, and pastes cleanly from an existing doc.
 */
function linesToList(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export function SopEditorPage() {
  const params = useParams();
  const navigate = useNavigate();
  const equipmentId = params.equipmentId as Id<"equipment"> | undefined;
  const { isAuthenticated } = useConvexAuth();

  const equipment = useQuery(
    api.equipment.getEquipment,
    isAuthenticated && equipmentId ? { equipmentId } : "skip",
  );
  const sopData = useQuery(
    api.equipmentSop.getEquipmentSop,
    isAuthenticated && equipmentId ? { equipmentId } : "skip",
  );
  const saveSop = useMutation(api.equipmentSop.saveEquipmentSop);
  const unpublishSop = useMutation(api.equipmentSop.unpublishEquipmentSop);
  const generateImageUploadUrl = useMutation(api.equipmentSop.generateSopImageUploadUrl);

  const [summary, setSummary] = useState("");
  const [ppe, setPpe] = useState("");
  const [hazards, setHazards] = useState("");
  const [beforeUse, setBeforeUse] = useState("");
  const [afterUse, setAfterUse] = useState("");
  const [steps, setSteps] = useState<StepDraft[]>([{ title: "", detail: "" }]);
  const [saving, setSaving] = useState(false);
  const [uploadingStep, setUploadingStep] = useState<number | null>(null);
  const [loadedForId, setLoadedForId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingStepIndex = useRef<number | null>(null);

  // Seed the form once the SOP arrives, without clobbering in-progress edits on refetch.
  useEffect(() => {
    if (!sopData || loadedForId === equipmentId) {
      return;
    }

    const sop = sopData.sop;

    if (sop) {
      // Hydrate editable form state once the saved SOP loads.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSummary(sop.summary ?? "");
      setPpe(sop.ppe.join("\n"));
      setHazards(sop.hazards.join("\n"));
      setBeforeUse(sop.beforeUse.join("\n"));
      setAfterUse(sop.afterUse.join("\n"));
      setSteps(
        sop.steps.length > 0
          ? sop.steps.map((step) => ({
              title: step.title,
              detail: step.detail ?? "",
              imageStorageId: step.imageStorageId,
              imageUrl: step.imageUrl,
            }))
          : [{ title: "", detail: "" }],
      );
    }

    setLoadedForId(equipmentId ?? null);
  }, [sopData, equipmentId, loadedForId]);

  function updateStep(index: number, patch: Partial<StepDraft>) {
    setSteps((current) =>
      current.map((step, stepIndex) => (stepIndex === index ? { ...step, ...patch } : step)),
    );
  }

  function moveStep(index: number, direction: -1 | 1) {
    setSteps((current) => {
      const target = index + direction;

      if (target < 0 || target >= current.length) {
        return current;
      }

      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];

      return next;
    });
  }

  async function handleImageSelected(files: FileList | null) {
    const index = pendingStepIndex.current;
    const file = files?.[0];
    pendingStepIndex.current = null;

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    if (index === null || !file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast.error("Choose an image file.");
      return;
    }

    if (file.size > MAX_IMAGE_BYTES) {
      toast.error("Images must be 10 MB or smaller.");
      return;
    }

    setUploadingStep(index);

    try {
      const uploadUrl = await generateImageUploadUrl({});
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!response.ok) {
        throw new Error("Upload failed.");
      }

      const { storageId } = (await response.json()) as { storageId: Id<"_storage"> };

      updateStep(index, {
        imageStorageId: storageId,
        imageUrl: URL.createObjectURL(file),
      });
      toast.success("Image added. Save to keep it.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to upload image");
    } finally {
      setUploadingStep(null);
    }
  }

  async function handleSave(publish: boolean) {
    if (!equipmentId) {
      return;
    }

    const preparedSteps = steps
      .map((step) => ({
        title: step.title.trim(),
        detail: step.detail.trim() || undefined,
        imageStorageId: step.imageStorageId,
      }))
      .filter((step) => step.title.length > 0 || step.detail);

    if (publish && preparedSteps.length === 0) {
      toast.error("Add at least one step before publishing.");
      return;
    }

    setSaving(true);

    try {
      await saveSop({
        equipmentId,
        summary: summary.trim() || undefined,
        ppe: linesToList(ppe),
        hazards: linesToList(hazards),
        steps: preparedSteps,
        beforeUse: linesToList(beforeUse),
        afterUse: linesToList(afterUse),
        publish,
      });

      toast.success(
        publish
          ? "SOP published. Students will be asked to acknowledge the new version."
          : "Draft saved",
      );

      if (publish) {
        navigate(`/tools/${equipmentId}`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save SOP");
    } finally {
      setSaving(false);
    }
  }

  async function handleUnpublish() {
    if (!equipmentId) {
      return;
    }

    try {
      await unpublishSop({ equipmentId });
      toast.success("SOP unpublished");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to unpublish SOP");
    }
  }

  if (!equipmentId) {
    return null;
  }

  if (sopData && !sopData.canEdit) {
    return (
      <div className="mx-auto max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle>You cannot edit this SOP</CardTitle>
            <CardDescription>
              Only admins, mentors, and instructors can write standard operating procedures.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const isPublished = sopData?.sop?.isPublished ?? false;

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeading
        eyebrow="Shop Tools"
        title={equipment ? `${equipment.name} SOP` : "Standard operating procedure"}
        description="Write the procedure students read at the machine. Publishing bumps the version and asks everyone to re-acknowledge."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="ghost">
              <Link to={`/tools/${equipmentId}`}>
                <ArrowLeft className="size-4" />
                Back to tool
              </Link>
            </Button>
            <Button variant="outline" onClick={() => void handleSave(false)} disabled={saving}>
              <Save className="size-4" />
              Save draft
            </Button>
            <Button onClick={() => void handleSave(true)} disabled={saving}>
              <Send className="size-4" />
              {isPublished ? "Publish new version" : "Publish"}
            </Button>
          </div>
        }
      />

      <div className="space-y-4">
        <div className="rounded-md border p-4">
          <Label htmlFor="sop-summary">Summary</Label>
          <Textarea
            id="sop-summary"
            className="mt-2"
            rows={3}
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            placeholder="What this tool is for and when to use it."
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-md border p-4">
            <Label htmlFor="sop-ppe">Required PPE</Label>
            <p className="mt-1 text-xs text-muted-foreground">One item per line.</p>
            <Textarea
              id="sop-ppe"
              className="mt-2"
              rows={5}
              value={ppe}
              onChange={(event) => setPpe(event.target.value)}
              placeholder={"Safety glasses\nNo gloves\nHair tied back"}
            />
          </div>
          <div className="rounded-md border p-4">
            <Label htmlFor="sop-hazards">Hazards</Label>
            <p className="mt-1 text-xs text-muted-foreground">One item per line.</p>
            <Textarea
              id="sop-hazards"
              className="mt-2"
              rows={5}
              value={hazards}
              onChange={(event) => setHazards(event.target.value)}
              placeholder={"Blade pinch point\nKickback on round stock"}
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-md border p-4">
            <Label htmlFor="sop-before">Before you start</Label>
            <p className="mt-1 text-xs text-muted-foreground">One item per line.</p>
            <Textarea
              id="sop-before"
              className="mt-2"
              rows={4}
              value={beforeUse}
              onChange={(event) => setBeforeUse(event.target.value)}
            />
          </div>
          <div className="rounded-md border p-4">
            <Label htmlFor="sop-after">When you finish</Label>
            <p className="mt-1 text-xs text-muted-foreground">One item per line.</p>
            <Textarea
              id="sop-after"
              className="mt-2"
              rows={4}
              value={afterUse}
              onChange={(event) => setAfterUse(event.target.value)}
            />
          </div>
        </div>

        <div className="rounded-md border p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Procedure steps</h2>
              <p className="text-sm text-muted-foreground">
                Numbered in order. Add a photo where the wording alone is not enough.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => setSteps((current) => [...current, { title: "", detail: "" }])}
            >
              <Plus className="size-4" />
              Add step
            </Button>
          </div>

          <div className="mt-4 grid gap-3">
            {steps.map((step, index) => (
              <div key={index} className="rounded-md border p-3">
                <div className="flex items-start gap-3">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1 space-y-2">
                    <Input
                      value={step.title}
                      onChange={(event) => updateStep(index, { title: event.target.value })}
                      placeholder="Step title"
                    />
                    <Textarea
                      rows={2}
                      value={step.detail}
                      onChange={(event) => updateStep(index, { detail: event.target.value })}
                      placeholder="Detail (optional)"
                    />
                    {step.imageUrl && (
                      <div className="relative w-fit">
                        <img
                          src={step.imageUrl}
                          alt={step.title || `Step ${index + 1}`}
                          className="max-h-48 rounded-md border object-contain"
                        />
                        <Button
                          type="button"
                          size="icon"
                          variant="secondary"
                          className="absolute right-2 top-2 size-7"
                          onClick={() =>
                            updateStep(index, { imageStorageId: undefined, imageUrl: null })
                          }
                          aria-label="Remove image"
                        >
                          <X className="size-4" />
                        </Button>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={uploadingStep === index}
                        onClick={() => {
                          pendingStepIndex.current = index;
                          fileInputRef.current?.click();
                        }}
                      >
                        <ImagePlus className="size-4" />
                        {uploadingStep === index
                          ? "Uploading..."
                          : step.imageUrl
                            ? "Replace image"
                            : "Add image"}
                      </Button>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col gap-1">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="size-8"
                      disabled={index === 0}
                      onClick={() => moveStep(index, -1)}
                      aria-label="Move step up"
                    >
                      <ArrowUp className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="size-8"
                      disabled={index === steps.length - 1}
                      onClick={() => moveStep(index, 1)}
                      aria-label="Move step down"
                    >
                      <ArrowDown className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="size-8 text-destructive"
                      onClick={() =>
                        setSteps((current) =>
                          current.length === 1
                            ? [{ title: "", detail: "" }]
                            : current.filter((_, stepIndex) => stepIndex !== index),
                        )
                      }
                      aria-label="Delete step"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {isPublished && (
          <div className="rounded-md border border-destructive/40 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-medium">Unpublish this SOP</h2>
                <p className="text-sm text-muted-foreground">
                  Hides it from students until you publish again. Acknowledgements are kept.
                </p>
              </div>
              <Button variant="outline" onClick={() => void handleUnpublish()}>
                Unpublish
              </Button>
            </div>
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => void handleImageSelected(event.target.files)}
      />
    </div>
  );
}
