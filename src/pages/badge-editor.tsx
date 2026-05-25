import { useConvexAuth } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import { ArrowLeft, Award, Save } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { toast } from "sonner";

import { PageHeading } from "@/components/page-heading";
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
import { Textarea } from "@/components/ui/textarea";
import { useEffectiveRole } from "@/providers/role-preview-provider";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";

type BadgeForm = {
  title: string;
  description: string;
  criteriaSummary: string;
  requiredTrackIds: Id<"trainingTracks">[];
  requiredEquipmentIds: Id<"equipment">[];
  isActive: boolean;
};

const emptyForm: BadgeForm = {
  title: "",
  description: "",
  criteriaSummary: "",
  requiredTrackIds: [],
  requiredEquipmentIds: [],
  isActive: true,
};

function toggleId<T extends string>(ids: T[], id: T, checked: boolean) {
  if (checked) {
    return ids.includes(id) ? ids : [...ids, id];
  }

  return ids.filter((item) => item !== id);
}

export function BadgeEditorPage() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const navigate = useNavigate();
  const params = useParams();
  const badgeId = params.badgeId as Id<"badges"> | undefined;
  const viewer = useQuery(api.profiles.viewer, isAuthenticated ? {} : "skip");
  const effectiveRole = useEffectiveRole(viewer?.profile.role);
  const isAdmin = effectiveRole === "admin";
  const badge = useQuery(
    api.badges.getBadgeForEdit,
    isAuthenticated && isAdmin && badgeId ? { badgeId } : "skip",
  );
  const options = useQuery(
    api.badges.listRequirementOptions,
    isAuthenticated && isAdmin ? {} : "skip",
  );
  const saveBadge = useMutation(api.badges.saveBadge);
  const [form, setForm] = useState<BadgeForm>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!badge) {
      return;
    }

    // Hydrate editable form state after the badge loads.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm({
      title: badge.title,
      description: badge.description,
      criteriaSummary: badge.criteriaSummary,
      requiredTrackIds: badge.requiredTrackIds,
      requiredEquipmentIds: badge.requiredEquipmentIds,
      isActive: badge.isActive,
    });
  }, [badge]);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);

    try {
      const savedBadgeId = await saveBadge({ badgeId, ...form });
      toast.success("Badge saved");
      navigate(`/badges/${savedBadgeId}/edit`, { replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save badge");
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl">
        <PageHeading eyebrow="Badges" title="Edit badge" description="Loading badge editor." />
      </div>
    );
  }

  if (!isAuthenticated || !isAdmin) {
    return (
      <div className="mx-auto max-w-6xl">
        <PageHeading
          eyebrow="Badges"
          title="Admin access required"
          description="Only admins can create and modify badges."
          actions={
            <Button asChild variant="outline">
              <Link to="/badges">
                <ArrowLeft className="size-4" />
                Back to badges
              </Link>
            </Button>
          }
        />
      </div>
    );
  }

  if ((badgeId && badge === undefined) || options === undefined) {
    return (
      <div className="mx-auto max-w-6xl">
        <PageHeading eyebrow="Badges" title="Edit badge" description="Loading badge editor." />
      </div>
    );
  }

  if (badgeId && badge === null) {
    return (
      <div className="mx-auto max-w-6xl">
        <PageHeading
          eyebrow="Badges"
          title="Badge not found"
          description="This badge may have been removed."
          actions={
            <Button asChild variant="outline">
              <Link to="/badges">
                <ArrowLeft className="size-4" />
                Back to badges
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
        eyebrow="Badges"
        title={badgeId ? "Edit badge" : "Create badge"}
        description="Name the badge and select the training or equipment requirements needed to earn it."
        actions={
          <Button asChild variant="outline">
            <Link to="/badges">
              <ArrowLeft className="size-4" />
              Back to badges
            </Link>
          </Button>
        }
      />

      <form onSubmit={handleSave} className="space-y-4">
        <Card>
          <CardHeader>
            <Award className="size-5 text-primary" />
            <CardTitle>Badge details</CardTitle>
            <CardDescription>
              Students earn active badges automatically after completing all selected requirements.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="badge-title">Badge name</Label>
              <Input
                id="badge-title"
                value={form.title}
                onChange={(event) =>
                  setForm((current) => ({ ...current, title: event.target.value }))
                }
                placeholder="Shop Safety Complete"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="badge-description">Description</Label>
              <Textarea
                id="badge-description"
                value={form.description}
                onChange={(event) =>
                  setForm((current) => ({ ...current, description: event.target.value }))
                }
                placeholder="Awarded after completing shop safety training."
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="badge-criteria">Criteria summary</Label>
              <Textarea
                id="badge-criteria"
                value={form.criteriaSummary}
                onChange={(event) =>
                  setForm((current) => ({ ...current, criteriaSummary: event.target.value }))
                }
                placeholder="Complete selected trainings and equipment sign-offs."
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={form.isActive}
                onCheckedChange={(checked) =>
                  setForm((current) => ({ ...current, isActive: checked === true }))
                }
              />
              Active badge
            </label>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Learning requirements</CardTitle>
            <CardDescription>
              Select learning tracks that must have every lesson marked complete.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 md:grid-cols-2">
            {options.tracks.length === 0 && (
              <p className="text-sm text-muted-foreground">No learning tracks yet.</p>
            )}
            {options.tracks.map((track) => (
              <label key={track._id} className="flex items-start gap-3 rounded-md border p-3 text-sm">
                <Checkbox
                  checked={form.requiredTrackIds.includes(track._id)}
                  onCheckedChange={(checked) =>
                    setForm((current) => ({
                      ...current,
                      requiredTrackIds: toggleId(
                        current.requiredTrackIds,
                        track._id,
                        checked === true,
                      ),
                    }))
                  }
                />
                <span className="min-w-0">
                  <span className="block font-medium">{track.title}</span>
                  <span className="block text-muted-foreground">{track.description}</span>
                </span>
              </label>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Equipment requirements</CardTitle>
            <CardDescription>
              Select equipment that must be signed off before the badge is awarded.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 md:grid-cols-2">
            {options.equipment.length === 0 && (
              <p className="text-sm text-muted-foreground">No equipment records yet.</p>
            )}
            {options.equipment.map((equipment) => (
              <label key={equipment._id} className="flex items-start gap-3 rounded-md border p-3 text-sm">
                <Checkbox
                  checked={form.requiredEquipmentIds.includes(equipment._id)}
                  onCheckedChange={(checked) =>
                    setForm((current) => ({
                      ...current,
                      requiredEquipmentIds: toggleId(
                        current.requiredEquipmentIds,
                        equipment._id,
                        checked === true,
                      ),
                    }))
                  }
                />
                <span className="min-w-0">
                  <span className="block font-medium">{equipment.name}</span>
                  <span className="block text-muted-foreground">{equipment.description}</span>
                </span>
              </label>
            ))}
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={isSaving}>
            <Save className="size-4" />
            {isSaving ? "Saving..." : "Save badge"}
          </Button>
        </div>
      </form>
    </div>
  );
}
