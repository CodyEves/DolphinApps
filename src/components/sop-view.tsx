import { useMutation, useQuery } from "convex/react";
import {
  AlertTriangle,
  CheckCircle2,
  HardHat,
  ListChecks,
  Pencil,
  ShieldAlert,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";

function formatDate(timestamp: number | undefined) {
  if (!timestamp) {
    return "";
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(timestamp));
}

function BulletList({
  title,
  icon: Icon,
  items,
  tone,
}: {
  title: string;
  icon: typeof HardHat;
  items: string[];
  tone: "warning" | "danger" | "neutral";
}) {
  if (items.length === 0) {
    return null;
  }

  const toneClass =
    tone === "danger"
      ? "border-destructive/40 bg-destructive/5"
      : tone === "warning"
        ? "border-amber-500/40 bg-amber-500/5"
        : "bg-card";

  return (
    <div className={`rounded-md border p-4 ${toneClass}`}>
      <div className="flex items-center gap-2 font-medium">
        <Icon className="size-4" />
        {title}
      </div>
      <ul className="mt-2 grid gap-1.5 text-sm">
        {items.map((item, index) => (
          <li key={`${item}-${index}`} className="flex gap-2">
            <span aria-hidden className="text-muted-foreground">
              &bull;
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The student-facing SOP: read it on a phone at the machine, then acknowledge.
 * Publishing a new version clears the acknowledgement, so a changed procedure
 * has to be re-read.
 */
export function SopView({ equipmentId }: { equipmentId: Id<"equipment"> }) {
  const sopData = useQuery(api.equipmentSop.getEquipmentSop, { equipmentId });
  const acknowledge = useMutation(api.equipmentSop.acknowledgeEquipmentSop);
  const [acknowledging, setAcknowledging] = useState(false);

  async function handleAcknowledge() {
    setAcknowledging(true);

    try {
      await acknowledge({ equipmentId });
      toast.success("SOP acknowledged");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to record acknowledgement");
    } finally {
      setAcknowledging(false);
    }
  }

  if (sopData === undefined) {
    return (
      <div className="rounded-md border p-4 text-sm text-muted-foreground">Loading SOP...</div>
    );
  }

  if (sopData === null) {
    return null;
  }

  const { sop, canEdit, hasAcknowledgedCurrentVersion } = sopData;

  if (!sop) {
    return (
      <div className="rounded-md border p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Standard operating procedure</h2>
            <p className="text-sm text-muted-foreground">
              No SOP has been written for this tool yet.
            </p>
          </div>
          {canEdit && (
            <Button asChild variant="outline">
              <Link to={`/tools/${equipmentId}/sop`}>
                <Pencil className="size-4" />
                Write SOP
              </Link>
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-md border p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold">Standard operating procedure</h2>
            {!sop.isPublished && <Badge variant="secondary">Draft</Badge>}
            {sop.isPublished && hasAcknowledgedCurrentVersion && (
              <Badge>
                <CheckCircle2 className="size-3" />
                Acknowledged
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {sop.isPublished
              ? `Version ${sop.version} - published ${formatDate(sop.publishedAt)}`
              : "Only editors can see this until it is published."}
          </p>
        </div>
        {canEdit && (
          <Button asChild variant="outline">
            <Link to={`/tools/${equipmentId}/sop`}>
              <Pencil className="size-4" />
              Edit SOP
            </Link>
          </Button>
        )}
      </div>

      {sop.summary && <p className="mt-4 text-sm">{sop.summary}</p>}

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <BulletList title="Required PPE" icon={HardHat} items={sop.ppe} tone="warning" />
        <BulletList title="Hazards" icon={ShieldAlert} items={sop.hazards} tone="danger" />
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <BulletList title="Before you start" icon={ListChecks} items={sop.beforeUse} tone="neutral" />
        <BulletList title="When you finish" icon={ListChecks} items={sop.afterUse} tone="neutral" />
      </div>

      {sop.steps.length > 0 && (
        <div className="mt-4">
          <div className="flex items-center gap-2 font-medium">
            <ListChecks className="size-4 text-primary" />
            Procedure
          </div>
          <ol className="mt-3 grid gap-3">
            {sop.steps.map((step, index) => (
              <li key={index} className="rounded-md border p-3">
                <div className="flex gap-3">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1 space-y-2">
                    {step.title && <p className="font-medium">{step.title}</p>}
                    {step.detail && (
                      <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                        {step.detail}
                      </p>
                    )}
                    {step.imageUrl && (
                      <img
                        src={step.imageUrl}
                        alt={step.title || `Step ${index + 1}`}
                        className="max-h-72 rounded-md border object-contain"
                      />
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {sop.isPublished && (
        <div className="mt-4 rounded-md border bg-muted/40 p-4">
          {hasAcknowledgedCurrentVersion ? (
            <p className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="size-4 text-primary" />
              You acknowledged version {sop.version} on{" "}
              {formatDate(sopData.acknowledgement?.acknowledgedAt)}.
            </p>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="flex items-start gap-2 text-sm">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />
                {sopData.acknowledgement
                  ? "This SOP changed since you last read it. Read it again and re-acknowledge."
                  : "Confirm you have read and understand this procedure."}
              </p>
              <Button
                type="button"
                onClick={() => void handleAcknowledge()}
                disabled={acknowledging}
              >
                <CheckCircle2 className="size-4" />
                {acknowledging ? "Saving..." : "I have read this SOP"}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
