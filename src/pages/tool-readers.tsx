import { useConvexAuth } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import {
  Check,
  Copy,
  CreditCard,
  KeyRound,
  Plus,
  RadioTower,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PageHeading } from "@/components/page-heading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { isAdminRole } from "@/lib/role-access";
import { useEffectiveRole } from "@/providers/role-preview-provider";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";

const UNASSIGNED = "__unassigned__";

function formatRelative(timestamp: number | undefined) {
  if (!timestamp) {
    return "never";
  }

  const minutes = Math.round((Date.now() - timestamp) / 60000);

  if (minutes < 1) {
    return "just now";
  }

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.round(minutes / 60);

  return hours < 24 ? `${hours}h ago` : `${Math.round(hours / 24)}d ago`;
}

function formatTime(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

/** Shown once after creating or rotating a key, since it is stored hashed. */
function DeviceKeyCallout({ deviceKey, onDismiss }: { deviceKey: string; onDismiss: () => void }) {
  return (
    <div className="mb-5 rounded-md border border-primary/40 bg-primary/5 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 font-medium">
            <KeyRound className="size-4 text-primary" />
            Device key - copy it now
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            This is the only time it is shown. Flash it to the reader, then keep it secret.
          </p>
          <code className="mt-2 block overflow-x-auto rounded bg-muted px-3 py-2 font-mono text-xs">
            {deviceKey}
          </code>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              void navigator.clipboard.writeText(deviceKey);
              toast.success("Device key copied");
            }}
          >
            <Copy className="size-4" />
            Copy
          </Button>
          <Button variant="ghost" size="icon" onClick={onDismiss} aria-label="Dismiss">
            <X className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function CardEnrollmentPanel() {
  const students = useQuery(api.toolReaders.listEnrollableStudents, {});
  const startEnrollment = useMutation(api.toolReaders.startCardEnrollment);
  const cancelEnrollment = useMutation(api.toolReaders.cancelCardEnrollment);
  const setCardUid = useMutation(api.toolReaders.setCardUid);

  const [targetUserId, setTargetUserId] = useState<string>("");
  const [sessionId, setSessionId] = useState<Id<"cardEnrollmentSessions"> | null>(null);
  const [manualUid, setManualUid] = useState("");

  const session = useQuery(
    api.toolReaders.watchCardEnrollment,
    sessionId ? { sessionId } : "skip",
  );

  // The window's own status drives the UI, so this effect only reports the outcome.
  useEffect(() => {
    if (session?.status === "completed") {
      toast.success("Card enrolled");
    } else if (session?.status === "expired") {
      toast.error("Enrollment window expired");
    }
  }, [session?.status]);

  const isWaiting = session?.status === "waiting";

  async function handleStart() {
    if (!targetUserId) {
      toast.error("Pick a student first.");
      return;
    }

    try {
      const id = await startEnrollment({ targetUserId: targetUserId as Id<"users"> });
      setSessionId(id);
      toast.info("Tap the card on any reader within 2 minutes.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to start enrollment");
    }
  }

  async function handleManual() {
    if (!targetUserId) {
      toast.error("Pick a student first.");
      return;
    }

    try {
      await setCardUid({
        targetUserId: targetUserId as Id<"users">,
        cardUid: manualUid,
      });
      setManualUid("");
      toast.success("Card saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save card");
    }
  }

  async function handleClear() {
    if (!targetUserId) {
      return;
    }

    try {
      await setCardUid({ targetUserId: targetUserId as Id<"users">, cardUid: null });
      toast.success("Card cleared");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to clear card");
    }
  }

  const selected = students?.find((student) => student.userId === targetUserId);

  return (
    <div className="rounded-md border p-4">
      <div className="flex items-center gap-2 font-medium">
        <CreditCard className="size-4 text-primary" />
        Enroll a badge card
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Open a 2-minute window, then have the student tap their card on any active reader.
        The reader binds the card to that student.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <div className="grid gap-2">
          <Label htmlFor="enroll-student">Student</Label>
          <Select value={targetUserId} onValueChange={setTargetUserId}>
            <SelectTrigger id="enroll-student">
              <SelectValue placeholder="Choose a student" />
            </SelectTrigger>
            <SelectContent>
              {students?.map((student) => (
                <SelectItem key={student.userId} value={student.userId}>
                  {student.name}
                  {student.hasCard ? " - card on file" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end gap-2">
          {isWaiting && sessionId ? (
            <Button
              variant="outline"
              onClick={() => {
                void cancelEnrollment({ sessionId });
                setSessionId(null);
              }}
            >
              Cancel
            </Button>
          ) : (
            <Button onClick={() => void handleStart()}>
              <RadioTower className="size-4" />
              Wait for tap
            </Button>
          )}
        </div>
      </div>

      {isWaiting && (
        <p className="mt-3 flex items-center gap-2 rounded-md border border-primary/40 bg-primary/5 px-3 py-2 text-sm">
          <RadioTower className="size-4 animate-pulse text-primary" />
          Waiting for a card tap...
        </p>
      )}

      {selected?.hasCard && (
        <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Check className="size-4 text-primary" />
          {selected.name} has a card on file.
          <Button variant="ghost" size="sm" onClick={() => void handleClear()}>
            Clear it
          </Button>
        </p>
      )}

      <div className="mt-4 border-t pt-4">
        <Label htmlFor="manual-uid">Or enter the card number manually</Label>
        <div className="mt-2 flex flex-wrap gap-2">
          <Input
            id="manual-uid"
            className="max-w-xs font-mono"
            placeholder="04A3B2C1"
            value={manualUid}
            onChange={(event) => setManualUid(event.target.value)}
          />
          <Button variant="outline" onClick={() => void handleManual()} disabled={!manualUid.trim()}>
            Save card
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ToolReadersPage() {
  const { isAuthenticated } = useConvexAuth();
  const viewer = useQuery(api.profiles.viewer, isAuthenticated ? {} : "skip");
  const effectiveRole = useEffectiveRole(viewer?.profile.role);
  const isAdmin = isAdminRole(effectiveRole);

  const readers = useQuery(api.toolReaders.listReaders, isAuthenticated && isAdmin ? {} : "skip");
  const equipment = useQuery(
    api.equipment.listEquipment,
    isAuthenticated && isAdmin ? {} : "skip",
  );
  const events = useQuery(
    api.toolReaders.listRecentAccessEvents,
    isAuthenticated && isAdmin ? { limit: 25 } : "skip",
  );

  const createReader = useMutation(api.toolReaders.createReader);
  const updateReader = useMutation(api.toolReaders.updateReader);
  const rotateReaderKey = useMutation(api.toolReaders.rotateReaderKey);
  const deleteReader = useMutation(api.toolReaders.deleteReader);

  const [newName, setNewName] = useState("");
  const [newEquipmentId, setNewEquipmentId] = useState<string>(UNASSIGNED);
  const [issuedKey, setIssuedKey] = useState<string | null>(null);

  async function handleCreate() {
    if (!newName.trim()) {
      toast.error("Give the reader a name.");
      return;
    }

    try {
      const result = await createReader({
        name: newName,
        equipmentId:
          newEquipmentId === UNASSIGNED ? undefined : (newEquipmentId as Id<"equipment">),
      });
      setIssuedKey(result.deviceKey);
      setNewName("");
      setNewEquipmentId(UNASSIGNED);
      toast.success("Reader created");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create reader");
    }
  }

  async function handleRotate(readerId: Id<"toolReaders">) {
    try {
      const result = await rotateReaderKey({ readerId });
      setIssuedKey(result.deviceKey);
      toast.success("Key rotated. Update the device.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to rotate key");
    }
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle>Card readers are admin-only</CardTitle>
            <CardDescription>Ask an admin to manage shop tool readers.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeading
        eyebrow="Shop Tools"
        title="Card readers"
        description="Devices that gate tool power. Each holds a device key and asks this site whether the tapped card is signed off."
      />

      {issuedKey && <DeviceKeyCallout deviceKey={issuedKey} onDismiss={() => setIssuedKey(null)} />}

      <div className="space-y-5">
        <CardEnrollmentPanel />

        <div className="rounded-md border p-4">
          <div className="flex items-center gap-2 font-medium">
            <Plus className="size-4 text-primary" />
            Add a reader
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
            <div className="grid gap-2">
              <Label htmlFor="reader-name">Name</Label>
              <Input
                id="reader-name"
                placeholder="Bandsaw reader"
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="reader-tool">Tool</Label>
              <Select value={newEquipmentId} onValueChange={setNewEquipmentId}>
                <SelectTrigger id="reader-tool">
                  <SelectValue placeholder="Assign later" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNASSIGNED}>Assign later</SelectItem>
                  {equipment?.map((item) => (
                    <SelectItem key={item._id} value={item._id}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={() => void handleCreate()}>Create reader</Button>
            </div>
          </div>
        </div>

        <div className="rounded-md border">
          <div className="border-b px-4 py-3 font-medium">Readers</div>
          {readers === undefined ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">Loading readers...</p>
          ) : readers.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">
              No readers yet. Add one above to get a device key.
            </p>
          ) : (
            <div className="divide-y">
              {readers.map((reader) => (
                <div
                  key={reader._id}
                  className="flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{reader.name}</span>
                      <Badge variant={reader.isActive ? "default" : "secondary"}>
                        {reader.isActive ? "Active" : "Disabled"}
                      </Badge>
                      {!reader.equipmentName && <Badge variant="outline">No tool assigned</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {reader.equipmentName ?? "Unassigned"} &middot; key {reader.deviceKeyPreview}{" "}
                      &middot; last seen {formatRelative(reader.lastSeenAt)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Select
                      value={reader.equipmentId ?? UNASSIGNED}
                      onValueChange={(value) =>
                        void updateReader({
                          readerId: reader._id,
                          equipmentId: value === UNASSIGNED ? null : (value as Id<"equipment">),
                        })
                      }
                    >
                      <SelectTrigger className="w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                        {equipment?.map((item) => (
                          <SelectItem key={item._id} value={item._id}>
                            {item.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        void updateReader({ readerId: reader._id, isActive: !reader.isActive })
                      }
                    >
                      {reader.isActive ? "Disable" : "Enable"}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => void handleRotate(reader._id)}>
                      <KeyRound className="size-4" />
                      Rotate key
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      onClick={() => void deleteReader({ readerId: reader._id })}
                      aria-label={`Delete ${reader.name}`}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-md border">
          <div className="border-b px-4 py-3 font-medium">Recent taps</div>
          {events === undefined ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">Loading activity...</p>
          ) : events.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">
              No card taps recorded yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">When</th>
                    <th className="px-4 py-3 font-medium">Tool</th>
                    <th className="px-4 py-3 font-medium">Student</th>
                    <th className="px-4 py-3 font-medium">Card</th>
                    <th className="px-4 py-3 font-medium">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {events.map((event) => (
                    <tr key={event._id}>
                      <td className="px-4 py-2 text-muted-foreground">
                        {formatTime(event.createdAt)}
                      </td>
                      <td className="px-4 py-2">{event.equipmentName ?? "-"}</td>
                      <td className="px-4 py-2">{event.studentName ?? "Unknown"}</td>
                      <td className="px-4 py-2 font-mono text-xs text-muted-foreground">
                        {event.cardUid || "-"}
                      </td>
                      <td className="px-4 py-2">
                        <Badge variant={event.decision === "allowed" ? "default" : "secondary"}>
                          {event.reasonLabel}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
