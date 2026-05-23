import { useConvexAuth } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import {
  Image,
  MousePointer2,
  Paintbrush,
  RotateCcw,
  Save,
  Type,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useEffectiveRole } from "@/providers/role-preview-provider";
import { cn } from "@/lib/utils";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";

type BuilderEditKind = "text" | "color" | "background" | "image";

type BuilderTarget = {
  key: string;
  label: string;
  kind: "text" | "image";
  text: string;
  color: string;
  background: string;
  image: string;
};

type BuilderElement = HTMLElement & {
  dataset: HTMLElement["dataset"] & {
    websiteBuilderKey?: string;
    websiteBuilderKind?: "text" | "image";
    websiteBuilderOriginalText?: string;
    websiteBuilderOriginalHtml?: string;
    websiteBuilderOriginalColor?: string;
    websiteBuilderOriginalBackground?: string;
    websiteBuilderOriginalImage?: string;
    websiteBuilderOriginalMinHeight?: string;
  };
};

const editableSelector = [
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "p",
  "span",
  "a",
  "button",
  "label",
  "li",
  "img",
  "[data-builder-editable]",
  "[data-builder-image]",
].join(",");

function cleanPagePath(pathname: string) {
  return pathname || "/";
}

function isBuilderElement(element: Element): element is BuilderElement {
  return element instanceof HTMLElement;
}

function shouldSkipElement(element: HTMLElement) {
  return Boolean(
    element.closest("[data-website-builder-ui]") ||
      element.closest("[data-radix-popper-content-wrapper]") ||
      element.closest("input, textarea, select") ||
      element.getAttribute("aria-hidden") === "true",
  );
}

function visibleText(element: HTMLElement) {
  return (element.textContent ?? "").replace(/\s+/g, " ").trim();
}

function isUsefulTarget(element: HTMLElement) {
  if (shouldSkipElement(element)) {
    return false;
  }

  if (element instanceof HTMLImageElement || element.matches("[data-builder-image]")) {
    return true;
  }

  if (element.children.length > 2 && !element.hasAttribute("data-builder-editable")) {
    return false;
  }

  return visibleText(element).length > 0;
}

function getTargets(scope: HTMLElement) {
  return Array.from(scope.querySelectorAll(editableSelector)).filter(
    (element): element is BuilderElement =>
      isBuilderElement(element) && isUsefulTarget(element),
  );
}

function hydrateTargets(scope: HTMLElement) {
  const targets = getTargets(scope);

  targets.forEach((element, index) => {
    const kind =
      element instanceof HTMLImageElement || element.matches("[data-builder-image]")
        ? "image"
        : "text";
    const key = element.dataset.builderId ?? `${kind}:${index}`;

    element.dataset.websiteBuilderKey = key;
    element.dataset.websiteBuilderKind = kind;

    if (element.dataset.websiteBuilderOriginalText === undefined) {
      element.dataset.websiteBuilderOriginalText = element.textContent ?? "";
    }

    if (element.dataset.websiteBuilderOriginalHtml === undefined) {
      element.dataset.websiteBuilderOriginalHtml = element.innerHTML;
    }

    if (element.dataset.websiteBuilderOriginalColor === undefined) {
      element.dataset.websiteBuilderOriginalColor = element.style.color;
    }

    if (element.dataset.websiteBuilderOriginalBackground === undefined) {
      element.dataset.websiteBuilderOriginalBackground = element.style.background;
    }

    if (element.dataset.websiteBuilderOriginalMinHeight === undefined) {
      element.dataset.websiteBuilderOriginalMinHeight = element.style.minHeight;
    }

    if (element.dataset.websiteBuilderOriginalImage === undefined) {
      element.dataset.websiteBuilderOriginalImage =
        element instanceof HTMLImageElement
          ? element.currentSrc || element.src
          : element.style.backgroundImage;
    }
  });

  return targets;
}

function applyEdit(element: BuilderElement, kind: BuilderEditKind, value: string) {
  if (kind === "text") {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let textNode = walker.nextNode();

    while (textNode && !(textNode.textContent ?? "").trim()) {
      textNode = walker.nextNode();
    }

    if (textNode) {
      textNode.textContent = value;
    } else {
      element.textContent = value;
    }

    return;
  }

  if (kind === "color") {
    element.style.color = value;
    return;
  }

  if (kind === "background") {
    element.style.backgroundColor = value;
    return;
  }

  if (element instanceof HTMLImageElement) {
    element.src = value;
    return;
  }

  element.style.backgroundImage = `url("${value}")`;
  element.style.backgroundPosition = "center";
  element.style.backgroundSize = "cover";
  element.style.minHeight = element.style.minHeight || "10rem";
}

function restoreTarget(element: BuilderElement) {
  if (element.dataset.websiteBuilderKind === "text") {
    element.innerHTML =
      element.dataset.websiteBuilderOriginalHtml ??
      element.dataset.websiteBuilderOriginalText ??
      "";
  } else if (element instanceof HTMLImageElement) {
    element.src = element.dataset.websiteBuilderOriginalImage ?? element.src;
  } else {
    element.style.backgroundImage = element.dataset.websiteBuilderOriginalImage ?? "";
  }

  element.style.color = element.dataset.websiteBuilderOriginalColor ?? "";
  element.style.background = element.dataset.websiteBuilderOriginalBackground ?? "";
  element.style.minHeight = element.dataset.websiteBuilderOriginalMinHeight ?? "";
}

function describeTarget(element: HTMLElement) {
  if (element instanceof HTMLImageElement) {
    return element.alt || "Image";
  }

  return visibleText(element).slice(0, 48) || element.tagName.toLowerCase();
}

function readTarget(element: BuilderElement): BuilderTarget {
  const computed = window.getComputedStyle(element);
  const imageValue =
    element instanceof HTMLImageElement
      ? element.currentSrc || element.src
      : element.style.backgroundImage.replace(/^url\(["']?/, "").replace(/["']?\)$/, "");

  return {
    key: element.dataset.websiteBuilderKey ?? "",
    label: describeTarget(element),
    kind: element.dataset.websiteBuilderKind ?? "text",
    text: visibleText(element),
    color: element.style.color || computed.color,
    background: element.style.backgroundColor || computed.backgroundColor,
    image: imageValue,
  };
}

function valueForKind(
  edits: Array<{ kind: BuilderEditKind; value: string }> | undefined,
  kind: BuilderEditKind,
) {
  return edits?.find((edit) => edit.kind === kind)?.value ?? "";
}

export function WebsiteBuilder() {
  const location = useLocation();
  const pagePath = cleanPagePath(location.pathname);
  const { isAuthenticated } = useConvexAuth();
  const viewer = useQuery(api.profiles.viewer, isAuthenticated ? {} : "skip");
  const role = useEffectiveRole(viewer?.profile.role);
  const isAdmin = role === "admin";
  const edits = useQuery(api.websiteBuilder.listEdits, { pagePath });
  const saveEdit = useMutation(api.websiteBuilder.saveEdit);
  const deleteEdit = useMutation(api.websiteBuilder.deleteEdit);
  const generateImageUploadUrl = useMutation(api.websiteBuilder.generateImageUploadUrl);
  const saveImageEdit = useMutation(api.websiteBuilder.saveImageEdit);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState<BuilderTarget | null>(null);
  const [textValue, setTextValue] = useState("");
  const [colorValue, setColorValue] = useState("#0f172a");
  const [backgroundValue, setBackgroundValue] = useState("#ffffff");
  const [imageValue, setImageValue] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const selectedEdits = useMemo(
    () => edits?.filter((edit) => edit.targetKey === selectedTarget?.key),
    [edits, selectedTarget?.key],
  );

  useEffect(() => {
    if (!isAdmin) {
      setIsEditing(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    document.body.classList.toggle("website-builder-active", isEditing);

    return () => {
      document.body.classList.remove("website-builder-active");
    };
  }, [isEditing]);

  useEffect(() => {
    const scope = document.querySelector<HTMLElement>("[data-website-builder-scope]");

    if (!scope || !edits) {
      return;
    }

    const targets = hydrateTargets(scope);

    for (const target of targets) {
      restoreTarget(target);
    }

    for (const edit of edits) {
      const target = scope.querySelector<BuilderElement>(
        `[data-website-builder-key="${CSS.escape(edit.targetKey)}"]`,
      );

      if (target) {
        applyEdit(target, edit.kind, edit.value);
      }
    }
  }, [edits, location.pathname]);

  useEffect(() => {
    if (!isEditing) {
      return;
    }

    const scope = document.querySelector<HTMLElement>("[data-website-builder-scope]");

    if (!scope) {
      return;
    }

    const activeScope = scope;

    hydrateTargets(activeScope);

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;

      if (!(target instanceof Element) || target.closest("[data-website-builder-ui]")) {
        return;
      }

      const editable = target.closest<BuilderElement>("[data-website-builder-key]");

      if (!editable || !activeScope.contains(editable)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      setSelectedTarget(readTarget(editable));
    }

    activeScope.addEventListener("pointerdown", handlePointerDown, true);

    return () => {
      activeScope.removeEventListener("pointerdown", handlePointerDown, true);
    };
  }, [isEditing, location.pathname, edits]);

  useEffect(() => {
    if (!selectedTarget) {
      return;
    }

    setTextValue(valueForKind(selectedEdits, "text") || selectedTarget.text);
    setColorValue(valueForKind(selectedEdits, "color") || selectedTarget.color);
    setBackgroundValue(
      valueForKind(selectedEdits, "background") || selectedTarget.background,
    );
    setImageValue(valueForKind(selectedEdits, "image") || selectedTarget.image);
  }, [selectedEdits, selectedTarget]);

  if (!isAdmin) {
    return null;
  }

  async function handleSave(kind: BuilderEditKind, value: string) {
    if (!selectedTarget) {
      return;
    }

    setIsSaving(true);

    try {
      await saveEdit({
        pagePath,
        targetKey: selectedTarget.key,
        kind,
        value,
      });
      toast.success("Page edit saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save edit");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(kind: BuilderEditKind) {
    const edit = selectedEdits?.find((candidate) => candidate.kind === kind);

    if (!edit) {
      return;
    }

    setIsSaving(true);

    try {
      await deleteEdit({ editId: edit._id });
      toast.success("Page edit reset");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to reset edit");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleImageUpload(files: FileList | null) {
    const file = files?.[0];

    if (!file || !selectedTarget) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast.error("Choose an image file.");
      return;
    }

    setIsUploading(true);

    try {
      const uploadUrl = await generateImageUploadUrl({});
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: {
          "Content-Type": file.type || "application/octet-stream",
        },
        body: file,
      });

      if (!response.ok) {
        throw new Error(`Unable to upload ${file.name}.`);
      }

      const { storageId } = (await response.json()) as { storageId: Id<"_storage"> };

      await saveImageEdit({
        pagePath,
        targetKey: selectedTarget.key,
        storageId,
      });
      toast.success("Image saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to upload image");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div data-website-builder-ui>
      <Button
        type="button"
        variant={isEditing ? "default" : "outline"}
        size="sm"
        onClick={() => {
          setIsEditing((current) => !current);
          setSelectedTarget(null);
        }}
      >
        <Paintbrush className="size-4" />
        {isEditing ? "Editing" : "Edit site"}
      </Button>

      {isEditing && (
        <aside className="fixed top-20 right-4 z-50 flex max-h-[calc(100vh-6rem)] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-lg border bg-background shadow-xl">
          <div className="flex items-start justify-between gap-3 border-b p-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">Builder</Badge>
                <Badge variant="outline">{pagePath}</Badge>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {selectedTarget
                  ? selectedTarget.label
                  : "Click text, buttons, links, or images on this page."}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => {
                setIsEditing(false);
                setSelectedTarget(null);
              }}
              aria-label="Close builder"
            >
              <X className="size-4" />
            </Button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {!selectedTarget ? (
              <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                <MousePointer2 className="size-6 text-primary" />
                Select something on the page to change its content or style.
              </div>
            ) : (
              <div className="space-y-5">
                {selectedTarget.kind === "text" && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <Label className="gap-2">
                        <Type className="size-4" />
                        Text
                      </Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={isSaving || !valueForKind(selectedEdits, "text")}
                        onClick={() => void handleDelete("text")}
                      >
                        <RotateCcw className="size-4" />
                        Reset
                      </Button>
                    </div>
                    <Textarea
                      value={textValue}
                      onChange={(event) => setTextValue(event.target.value)}
                      className="min-h-28"
                    />
                    <Button
                      type="button"
                      className="w-full"
                      disabled={isSaving}
                      onClick={() => void handleSave("text", textValue)}
                    >
                      <Save className="size-4" />
                      Save text
                    </Button>
                  </div>
                )}

                <Separator />

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="builder-text-color">Text color</Label>
                    <div className="grid grid-cols-[2.75rem_1fr] gap-2">
                      <Input
                        id="builder-text-color"
                        type="color"
                        value={colorValue.startsWith("#") ? colorValue : "#0f172a"}
                        onChange={(event) => setColorValue(event.target.value)}
                        className="p-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        disabled={isSaving}
                        onClick={() => void handleSave("color", colorValue)}
                      >
                        Save
                      </Button>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={isSaving || !valueForKind(selectedEdits, "color")}
                      onClick={() => void handleDelete("color")}
                    >
                      <RotateCcw className="size-4" />
                      Reset
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="builder-background-color">Background</Label>
                    <div className="grid grid-cols-[2.75rem_1fr] gap-2">
                      <Input
                        id="builder-background-color"
                        type="color"
                        value={
                          backgroundValue.startsWith("#") ? backgroundValue : "#ffffff"
                        }
                        onChange={(event) => setBackgroundValue(event.target.value)}
                        className="p-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        disabled={isSaving}
                        onClick={() => void handleSave("background", backgroundValue)}
                      >
                        Save
                      </Button>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={isSaving || !valueForKind(selectedEdits, "background")}
                      onClick={() => void handleDelete("background")}
                    >
                      <RotateCcw className="size-4" />
                      Reset
                    </Button>
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <Label className="gap-2">
                    <Image className="size-4" />
                    Picture
                  </Label>
                  <Input
                    type="url"
                    value={imageValue}
                    onChange={(event) => setImageValue(event.target.value)}
                    placeholder="https://example.com/photo.jpg"
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={isSaving || !imageValue.trim()}
                      onClick={() => void handleSave("image", imageValue)}
                    >
                      <Save className="size-4" />
                      Save URL
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={isUploading}
                      asChild
                    >
                      <label className={cn(isUploading && "pointer-events-none")}>
                        <Upload className="size-4" />
                        {isUploading ? "Uploading..." : "Upload"}
                        <input
                          type="file"
                          accept="image/*"
                          className="sr-only"
                          onChange={(event) => void handleImageUpload(event.target.files)}
                        />
                      </label>
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={isSaving || !valueForKind(selectedEdits, "image")}
                      onClick={() => void handleDelete("image")}
                    >
                      <RotateCcw className="size-4" />
                      Reset
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </aside>
      )}
    </div>
  );
}
