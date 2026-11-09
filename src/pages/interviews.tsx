import { useMutation, useQuery } from "convex/react";
import {
  CalendarPlus,
  Check,
  ClipboardCopy,
  ExternalLink,
  FileUp,
  KeyRound,
  Link2,
  Megaphone,
  Search,
  Sparkles,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { Fragment, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

import { PageHeading } from "@/components/page-heading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { PageSkeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  INTERVIEW_ROUND_SLUG,
  REVIEW_PAGE_PATH,
  dayNumber,
  firstName,
  formatDay,
  formatTime,
  minutesToTimeInput,
  parseAvailabilityCsv,
  publicName,
  reviewKeyFromLink,
  reviewLink,
  saveReviewKey,
  timeInputToMinutes,
  todayIso,
  useApplicantIndex,
  useEditorName,
  useMentorKey,
  type ApplicantLink,
  type ImportRow,
} from "@/lib/interviews";
import { cn } from "@/lib/utils";
import { api } from "@convex/_generated/api";
import type { Doc, Id } from "@convex/_generated/dataModel";

type Round = Doc<"interviewRounds">;
type Candidate = Doc<"interviewCandidates">;
type Slot = Doc<"interviewSlots">;
type Creds = { key?: string; editorName?: string };
type Filter = "todo" | "scheduled" | "all" | "withdrawn";

function friendlyError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const match = message.match(/Uncaught Error: (.+?)(?:\n|\s+at |$)/);
  return match?.[1] ?? message.replace(/^\[CONVEX [^\]]+\]\s*/, "").split("\n")[0];
}

async function run<T>(action: Promise<T>, success?: string) {
  try {
    const result = await action;

    if (success) {
      toast.success(success);
    }

    return result;
  } catch (error) {
    toast.error(friendlyError(error));
    return undefined;
  }
}

function slotLabel(slot: Slot, rooms: number) {
  return `${formatDay(slot.date)} · ${formatTime(slot.startMinutes)}${rooms > 1 ? ` · ${slot.room}` : ""}`;
}

const selectClass =
  "h-9 w-full min-w-0 rounded-md border border-input bg-card px-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function InterviewBoardPage() {
  const mentorKey = useMentorKey();
  const editor = useEditorName();
  const access = useQuery(api.interviews.access, { key: mentorKey.key || undefined });
  const creds: Creds = useMemo(
    () => ({ key: mentorKey.key || undefined, editorName: editor.name || undefined }),
    [mentorKey.key, editor.name],
  );
  const board = useQuery(
    api.interviews.board,
    access?.canEdit ? { slug: INTERVIEW_ROUND_SLUG, key: creds.key } : "skip",
  );
  const ensureRound = useMutation(api.interviews.ensureRound);
  const ensured = useRef(false);

  useEffect(() => {
    if (board === null && !ensured.current) {
      ensured.current = true;
      void run(ensureRound({ slug: INTERVIEW_ROUND_SLUG, ...creds }));
    }
  }, [board, creds, ensureRound]);

  if (access === undefined) {
    return <PageSkeleton />;
  }

  if (!access.canEdit) {
    return <KeyGate keyConfigured={access.keyConfigured} hadKey={Boolean(mentorKey.key)} onKey={mentorKey.setKey} />;
  }

  if (!board) {
    return <PageSkeleton />;
  }

  return (
    <Board
      round={board.round}
      candidates={board.candidates}
      slots={board.slots}
      creds={creds}
      mentorKey={mentorKey.key}
      editorName={editor.name}
      onEditorName={editor.setName}
      signedInAs={access.signedInAs}
    />
  );
}

export function KeyGate({
  keyConfigured,
  hadKey,
  onKey,
}: {
  keyConfigured: boolean;
  hadKey: boolean;
  onKey: (key: string) => void;
}) {
  const checkKey = useMutation(api.interviews.checkKey);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const key = new URLSearchParams(value.split("#")[1] ?? "").get("key") ?? value.trim();
    setBusy(true);

    try {
      const result = await checkKey({ key });

      if (result.ok) {
        onKey(key);
      } else {
        toast.error("That key isn't right. Copy the whole mentor link, including everything after #.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl">
      <PageHeading
        title="Interview scheduling"
        description="Mentors plan interview times here. Students see the posted schedule once it's published."
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="size-4" /> Mentor link needed
          </CardTitle>
          <CardDescription>
            {keyConfigured
              ? hadKey
                ? "The key saved on this device no longer works. Paste the current mentor link from #mentors."
                : "Open the mentor link shared in #mentors, or paste it here. No account needed."
              : "The mentor key hasn't been set up yet. Run setup-interviews.bat in the Dolphin Apps folder."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {keyConfigured && (
            <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row">
              <Input
                value={value}
                onChange={(event) => setValue(event.target.value)}
                placeholder="Paste mentor link or key"
                aria-label="Mentor link or key"
                autoComplete="off"
              />
              <Button type="submit" disabled={busy || !value.trim()}>
                Open board
              </Button>
            </form>
          )}
          <p className="text-sm text-muted-foreground">
            Looking for your interview time?{" "}
            <Link to="/interviews/schedule" className="font-medium text-primary underline-offset-4 hover:underline">
              See the posted schedule
            </Link>
            .
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Board
// ---------------------------------------------------------------------------

function Board({
  round,
  candidates,
  slots,
  creds,
  mentorKey,
  editorName,
  onEditorName,
  signedInAs,
}: {
  round: Round;
  candidates: Candidate[];
  slots: Slot[];
  creds: Creds;
  mentorKey: string;
  editorName: string;
  onEditorName: (name: string) => void;
  signedInAs: string | null;
}) {
  const today = todayIso();
  const [day, setDay] = useState(() => round.dates.find((date) => date >= today) ?? round.dates[0] ?? "");
  const [selectedId, setSelectedId] = useState<Id<"interviewCandidates"> | null>(null);
  const [sheet, setSheet] = useState<"import" | "publish" | null>(null);
  const [reviewRefresh, setReviewRefresh] = useState(0);
  const applicants = useApplicantIndex(reviewRefresh);

  const candidateById = useMemo(() => new Map(candidates.map((c) => [c._id, c])), [candidates]);
  const slotByCandidate = useMemo(() => {
    const map = new Map<Id<"interviewCandidates">, Slot>();
    for (const slot of slots) {
      if (slot.candidateId) {
        map.set(slot.candidateId, slot);
      }
    }
    return map;
  }, [slots]);
  const roomCount = new Set(slots.map((slot) => slot.room)).size;

  const active = candidates.filter((c) => !c.withdrawn);
  const scheduledCount = active.filter((c) => slotByCandidate.has(c._id)).length;
  const openSlots = slots.filter((slot) => !slot.candidateId).length;
  const conflicts = slots.filter((slot) => {
    const c = slot.candidateId ? candidateById.get(slot.candidateId) : undefined;
    return c && !c.availableDates.includes(slot.date);
  }).length;
  const followUp = active.filter((c) => c.availableDates.length === 0).length;

  const pendingChanges = useMemo(() => {
    const draft = new Set(
      slots.flatMap((slot) => {
        const c = slot.candidateId ? candidateById.get(slot.candidateId) : undefined;
        return c && !c.withdrawn
          ? [`${slot.date}|${slot.startMinutes}|${slot.durationMinutes}|${slot.room}|${publicName(c.name, round.publicNameStyle)}|${slot.note ?? ""}`]
          : [];
      }),
    );
    const posted = new Set(
      (round.published?.slots ?? []).map(
        (s) => `${s.date}|${s.startMinutes}|${s.durationMinutes}|${s.room}|${s.name}|${s.note ?? ""}`,
      ),
    );
    let changes = 0;
    draft.forEach((key) => !posted.has(key) && changes++);
    posted.forEach((key) => !draft.has(key) && changes++);
    if (round.published) {
      if ((round.published.location ?? "") !== (round.location ?? "")) changes++;
      if ((round.published.message ?? "") !== (round.publicMessage ?? "")) changes++;
    }
    return changes;
  }, [slots, candidateById, round]);

  const selected = selectedId ? candidateById.get(selectedId) ?? null : null;

  async function copyMentorLink() {
    const link = `${window.location.origin}/interviews#key=${encodeURIComponent(mentorKey)}`;
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Mentor link copied. Share it in #mentors only.");
    } catch {
      window.prompt("Copy the mentor link:", link);
    }
  }

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeading
        title={round.title}
        description="Plan slots together. Every change saves right away and shows up for the other mentors live. Students see nothing until you publish."
        actions={
          <>
            {mentorKey && (
              <Button variant="outline" onClick={() => void copyMentorLink()}>
                <ClipboardCopy className="size-4" /> Copy mentor link
              </Button>
            )}
            <Button variant="outline" asChild>
              <Link to="/interviews/mentor">
                <Users className="size-4" /> Mentor schedule
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/interviews/schedule" target="_blank">
                <ExternalLink className="size-4" /> Public schedule
              </Link>
            </Button>
            <Button variant="cta" onClick={() => setSheet("publish")}>
              <Megaphone className="size-4" /> {round.published ? "Publish changes" : "Publish"}
            </Button>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Students" value={active.length} />
        <Stat label="Scheduled" value={scheduledCount} tone={scheduledCount === active.length && active.length > 0 ? "good" : undefined} />
        <Stat label="Still to place" value={active.length - scheduledCount} tone={active.length - scheduledCount > 0 ? "warn" : undefined} />
        <Stat label="Open slots" value={openSlots} />
        <Stat label="Day conflicts" value={conflicts} tone={conflicts ? "warn" : undefined} hint="Placed on a day they didn't pick" />
        <PublishStat round={round} pendingChanges={pendingChanges} onOpen={() => setSheet("publish")} />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
        {signedInAs ? (
          <span>Editing as {signedInAs}</span>
        ) : (
          <label className="flex items-center gap-2">
            <span>Editing as</span>
            <Input
              value={editorName}
              onChange={(event) => onEditorName(event.target.value)}
              placeholder="Your name"
              className="h-8 w-40"
            />
          </label>
        )}
        {round.lastEditedAt && (
          <span>
            Last change by {round.lastEditedBy ?? "a mentor"},{" "}
            {new Date(round.lastEditedAt).toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" })}
          </span>
        )}
      </div>

      {candidates.length === 0 ? (
        <EmptyImport round={round} creds={creds} />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="min-w-0 space-y-4">
            <DayPicker
              round={round}
              day={day}
              onDay={setDay}
              slots={slots}
              candidates={active}
              selected={selected}
              today={today}
            />
            {day && (
              <DayBoard
                key={day}
                round={round}
                day={day}
                slots={slots.filter((slot) => slot.date === day)}
                candidates={active}
                candidateById={candidateById}
                slotByCandidate={slotByCandidate}
                roomCount={roomCount}
                creds={creds}
                selected={selected}
                onSelect={setSelectedId}
                isPast={day < today}
              />
            )}
          </div>
          <CandidatePanel
            day={day}
            round={round}
            candidates={candidates}
            slotByCandidate={slotByCandidate}
            roomCount={roomCount}
            selectedId={selectedId}
            onSelect={(id) => {
              setSelectedId(id);
              const slot = id ? slotByCandidate.get(id) : undefined;
              if (slot) setDay(slot.date);
            }}
            creds={creds}
            applicants={applicants}
            onReviewKey={() => setReviewRefresh((n) => n + 1)}
            onImport={() => setSheet("import")}
            followUp={followUp}
          />
        </div>
      )}

      <ImportSheet open={sheet === "import"} onOpenChange={(open) => setSheet(open ? "import" : null)} round={round} creds={creds} />
      <PublishSheet
        open={sheet === "publish"}
        onOpenChange={(open) => setSheet(open ? "publish" : null)}
        round={round}
        creds={creds}
        pendingChanges={pendingChanges}
        unplaced={active.length - scheduledCount}
        hasSlots={slots.length > 0}
      />
    </div>
  );
}

function Stat({ label, value, tone, hint }: { label: string; value: number; tone?: "good" | "warn"; hint?: string }) {
  return (
    <div className="rounded-lg border bg-card px-4 py-3" title={hint}>
      <div
        className={cn(
          "font-heading text-2xl font-bold tabular-nums",
          tone === "good" && "text-success",
          tone === "warn" && "text-warning",
        )}
      >
        {value}
      </div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function PublishStat({ round, pendingChanges, onOpen }: { round: Round; pendingChanges: number; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="col-span-2 rounded-lg border bg-card px-4 py-3 text-left transition-colors hover:bg-accent sm:col-span-1"
    >
      {round.published ? (
        <>
          <div className={cn("font-heading text-base font-bold", pendingChanges ? "text-warning" : "text-success")}>
            {pendingChanges ? `${pendingChanges} unpublished` : "Up to date"}
          </div>
          <div className="text-xs text-muted-foreground">
            Posted {new Date(round.published.at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
          </div>
        </>
      ) : (
        <>
          <div className="font-heading text-base font-bold text-muted-foreground">Not posted</div>
          <div className="text-xs text-muted-foreground">Students can't see it yet</div>
        </>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Days
// ---------------------------------------------------------------------------

function DayPicker({
  round,
  day,
  onDay,
  slots,
  candidates,
  selected,
  today,
}: {
  round: Round;
  day: string;
  onDay: (day: string) => void;
  slots: Slot[];
  candidates: Candidate[];
  selected: Candidate | null;
  today: string;
}) {
  return (
    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Interview days">
      {round.dates.map((date) => {
        const daySlots = slots.filter((slot) => slot.date === date);
        const filled = daySlots.filter((slot) => slot.candidateId).length;
        const free = candidates.filter((c) => c.availableDates.includes(date)).length;
        const selectedFree = selected?.availableDates.includes(date);
        const isActive = date === day;

        return (
          <button
            key={date}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onDay(date)}
            className={cn(
              "relative min-w-[7.5rem] shrink-0 rounded-lg border bg-card px-3 py-2 text-left transition-colors hover:bg-accent",
              isActive && "border-primary ring-2 ring-primary/20",
              date < today && "opacity-60",
            )}
          >
            <div className="text-sm font-semibold">{formatDay(date)}</div>
            <div className="text-xs text-muted-foreground tabular-nums">
              {daySlots.length ? `${filled}/${daySlots.length} filled` : "No slots"} · {free} free
            </div>
            {selected && (
              <span
                className={cn(
                  "absolute top-2 right-2 size-2.5 rounded-full",
                  selectedFree ? "bg-success" : "bg-muted-foreground/30",
                )}
                title={selectedFree ? `${selected.name} is free` : `${selected.name} didn't pick this day`}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

function DayBoard({
  round,
  day,
  slots,
  candidates,
  candidateById,
  slotByCandidate,
  roomCount,
  creds,
  selected,
  onSelect,
  isPast,
}: {
  round: Round;
  day: string;
  slots: Slot[];
  candidates: Candidate[];
  candidateById: Map<Id<"interviewCandidates">, Candidate>;
  slotByCandidate: Map<Id<"interviewCandidates">, Slot>;
  roomCount: number;
  creds: Creds;
  selected: Candidate | null;
  onSelect: (id: Id<"interviewCandidates"> | null) => void;
  isPast: boolean;
}) {
  const [adding, setAdding] = useState(slots.length === 0);
  const assign = useMutation(api.interviews.assignSlot);
  const removeSlots = useMutation(api.interviews.removeSlots);
  const autoFill = useMutation(api.interviews.autoFill);
  const clearAssignments = useMutation(api.interviews.clearAssignments);
  const setPanel = useMutation(api.interviews.setPanelInterviewers);
  const updateNote = useMutation(api.interviews.updateSlotNote);

  const rooms = [...new Set(slots.map((slot) => slot.room))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const times = [...new Set(slots.map((slot) => slot.startMinutes))].sort((a, b) => a - b);
  const slotAt = new Map(slots.map((slot) => [`${slot.startMinutes}|${slot.room}`, slot]));
  const free = candidates.filter((c) => c.availableDates.includes(day));
  const freeUnscheduled = free.filter((c) => !slotByCandidate.has(c._id));
  const freeScheduled = free.filter((c) => slotByCandidate.has(c._id));
  const notFree = candidates.filter((c) => !c.availableDates.includes(day));
  const openCount = slots.filter((slot) => !slot.candidateId).length;
  const filledCount = slots.length - openCount;

  return (
    <Card className="overflow-hidden py-0">
      <CardHeader className="border-b bg-muted/25 px-5 py-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle className="font-heading text-xl">{formatDay(day, "long")}</CardTitle>
            <CardDescription>
              {free.length} students picked this day · {freeUnscheduled.length} of them still need a time
              {isPast && " · this day has passed"}
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setAdding((open) => !open)}>
              <CalendarPlus className="size-4" /> Add time block
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={openCount === 0 || freeUnscheduled.length === 0}
              onClick={async () => {
                const result = await run(autoFill({ roundId: round._id, dates: [day], ...creds }));
                if (result) {
                  toast.success(
                    result.assigned
                      ? `Placed ${result.assigned} student${result.assigned === 1 ? "" : "s"} on ${formatDay(day)}.`
                      : "Nobody else free this day fits an open slot.",
                  );
                }
              }}
            >
              <Sparkles className="size-4" /> Auto-fill this day
            </Button>
            {filledCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (window.confirm(`Clear all ${filledCount} students from ${formatDay(day)}? The slots stay.`)) {
                    void run(clearAssignments({ roundId: round._id, date: day, ...creds }), "Day cleared");
                  }
                }}
              >
                Clear day
              </Button>
            )}
            {openCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (window.confirm(`Remove the ${openCount} empty slot${openCount === 1 ? "" : "s"} on ${formatDay(day)}?`)) {
                    void run(
                      removeSlots({ slotIds: slots.filter((slot) => !slot.candidateId).map((slot) => slot._id), ...creds }),
                      "Empty slots removed",
                    );
                  }
                }}
              >
                <Trash2 className="size-4" /> Remove empty
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 px-5 py-5">
        {adding && (
          <AddBlockForm
            round={round}
            day={day}
            creds={creds}
            existingRooms={rooms}
            lastEnd={slots.length ? Math.max(...slots.map((slot) => slot.startMinutes + slot.durationMinutes)) : undefined}
            onDone={() => setAdding(false)}
          />
        )}

        {selected && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
            <span>
              Placing <b>{selected.name}</b>.{" "}
              {selected.availableDates.includes(day)
                ? "They picked this day. Click an open slot."
                : "They did not pick this day."}
            </span>
            <Button size="sm" variant="ghost" onClick={() => onSelect(null)}>
              Done
            </Button>
          </div>
        )}

        {slots.length === 0 ? (
          !adding && (
            <div className="rounded-lg border border-dashed bg-muted/20 p-6 text-center text-sm text-muted-foreground">
              No interview slots on this day yet. Use <b>Add time block</b> to make some.
            </div>
          )
        ) : (
          <div className="-mx-5 overflow-x-auto px-5">
            <table className="w-full border-separate border-spacing-0 text-sm">
              <thead>
                <tr>
                  <th className="w-24 pb-2 text-left align-bottom text-xs font-medium text-muted-foreground">Time</th>
                  {rooms.map((room) => (
                    <th key={room} className="min-w-[13rem] px-1 pb-2 text-left align-bottom font-normal">
                      <div className="font-semibold">{room}</div>
                      <PanelInput
                        key={round.panels.find((panel) => panel.date === day && panel.room === room)?.interviewers ?? ""}
                        value={round.panels.find((panel) => panel.date === day && panel.room === room)?.interviewers ?? ""}
                        onSave={(interviewers) =>
                          run(setPanel({ roundId: round._id, date: day, room, interviewers, ...creds }))
                        }
                      />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {times.map((time) => (
                  <tr key={time}>
                    <td className="border-t py-1.5 pr-2 align-top font-mono text-xs whitespace-nowrap text-muted-foreground tabular-nums">
                      {formatTime(time)}
                    </td>
                    {rooms.map((room) => {
                      const slot = slotAt.get(`${time}|${room}`);
                      return (
                        <td key={room} className="border-t px-1 py-1.5 align-top">
                          {slot ? (
                            <SlotCell
                              slot={slot}
                              day={day}
                              candidate={slot.candidateId ? candidateById.get(slot.candidateId) : undefined}
                              freeUnscheduled={freeUnscheduled}
                              freeScheduled={freeScheduled}
                              notFree={notFree}
                              slotByCandidate={slotByCandidate}
                              roomCount={roomCount}
                              selected={selected}
                              onAssign={(candidateId) =>
                                run(assign({ slotId: slot._id, candidateId: candidateId ?? undefined, ...creds }))
                              }
                              onRemove={() => run(removeSlots({ slotIds: [slot._id], ...creds }))}
                              onNote={(note) => run(updateNote({ slotId: slot._id, note, ...creds }))}
                              onPick={onSelect}
                            />
                          ) : (
                            <div className="h-9" />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PanelInput({ value, onSave }: { value: string; onSave: (value: string) => void }) {
  const [draft, setDraft] = useState(value);

  return (
    <Input
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => draft.trim() !== value && onSave(draft)}
      onKeyDown={(event) => event.key === "Enter" && (event.target as HTMLInputElement).blur()}
      placeholder="Interviewers"
      aria-label="Interviewers"
      className="mt-1 h-8 text-xs"
    />
  );
}

function SlotCell({
  slot,
  day,
  candidate,
  freeUnscheduled,
  freeScheduled,
  notFree,
  slotByCandidate,
  roomCount,
  selected,
  onAssign,
  onRemove,
  onNote,
  onPick,
}: {
  slot: Slot;
  day: string;
  candidate?: Candidate;
  freeUnscheduled: Candidate[];
  freeScheduled: Candidate[];
  notFree: Candidate[];
  slotByCandidate: Map<Id<"interviewCandidates">, Slot>;
  roomCount: number;
  selected: Candidate | null;
  onAssign: (id: Id<"interviewCandidates"> | null) => void;
  onRemove: () => void;
  onNote: (note: string) => void;
  onPick: (id: Id<"interviewCandidates"> | null) => void;
}) {
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState(slot.note ?? "");
  const conflict = candidate && !candidate.availableDates.includes(day);
  const canPlace = selected && selected._id !== candidate?._id && !candidate;

  if (canPlace) {
    return (
      <button
        type="button"
        onClick={() => {
          onAssign(selected._id);
          onPick(null);
        }}
        className={cn(
          "flex h-9 w-full items-center justify-center gap-1.5 rounded-md border border-dashed text-sm font-medium transition-colors",
          selected.availableDates.includes(day)
            ? "border-primary/60 text-primary hover:bg-primary/10"
            : "border-warning/60 text-warning hover:bg-warning/10",
        )}
      >
        <Check className="size-3.5" /> Place {firstName(selected.name)}
      </button>
    );
  }

  return (
    <div
      className={cn(
        "group rounded-md",
        candidate ? (conflict ? "bg-warning/10" : "bg-primary/[0.06]") : "",
      )}
    >
      <div className="flex items-center gap-1">
        <select
          className={cn(selectClass, candidate ? "font-medium" : "text-muted-foreground", conflict && "border-warning/60")}
          value={candidate?._id ?? ""}
          onChange={(event) => onAssign((event.target.value || null) as Id<"interviewCandidates"> | null)}
          aria-label={`${formatTime(slot.startMinutes)} ${slot.room}`}
        >
          <option value="">Open</option>
          {candidate && !freeUnscheduled.includes(candidate) && !freeScheduled.includes(candidate) && !notFree.includes(candidate) && (
            <option value={candidate._id}>{candidate.name}</option>
          )}
          <optgroup label="Picked this day · not placed yet">
            {freeUnscheduled.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </optgroup>
          <optgroup label="Picked this day · already placed (moves them)">
            {freeScheduled.map((c) => {
              const at = slotByCandidate.get(c._id);
              return (
                <option key={c._id} value={c._id}>
                  {c.name}
                  {at && at._id !== slot._id ? ` (now ${slotLabel(at, roomCount)})` : ""}
                </option>
              );
            })}
          </optgroup>
          <optgroup label="Didn't pick this day">
            {notFree.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </optgroup>
        </select>
        <button
          type="button"
          className="flex size-7 shrink-0 items-center justify-center rounded text-muted-foreground opacity-60 hover:bg-accent hover:text-foreground hover:opacity-100"
          onClick={() => setNoteOpen((open) => !open)}
          aria-label="Slot note"
          title="Add a note (e.g. Zoom)"
        >
          <span className="text-xs font-semibold">✎</span>
        </button>
        {!candidate && (
          <button
            type="button"
            className="flex size-7 shrink-0 items-center justify-center rounded text-muted-foreground opacity-60 hover:bg-accent hover:text-destructive hover:opacity-100"
            onClick={onRemove}
            aria-label="Remove slot"
            title="Remove this slot"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>
      {(conflict || slot.note || noteOpen) && (
        <div className="space-y-1 px-1 pt-1 pb-1">
          {conflict && <p className="text-xs font-medium text-warning">Didn't pick {formatDay(day)}</p>}
          {noteOpen ? (
            <Input
              autoFocus
              value={note}
              onChange={(event) => setNote(event.target.value)}
              onBlur={() => {
                setNoteOpen(false);
                if (note.trim() !== (slot.note ?? "")) onNote(note);
              }}
              onKeyDown={(event) => event.key === "Enter" && (event.target as HTMLInputElement).blur()}
              placeholder="Note shown on the public schedule"
              className="h-7 text-xs"
            />
          ) : (
            slot.note && <p className="text-xs text-muted-foreground">{slot.note}</p>
          )}
        </div>
      )}
    </div>
  );
}

function AddBlockForm({
  round,
  day,
  creds,
  existingRooms,
  lastEnd,
  onDone,
}: {
  round: Round;
  day: string;
  creds: Creds;
  existingRooms: string[];
  lastEnd?: number;
  onDone: () => void;
}) {
  const addSlots = useMutation(api.interviews.addSlots);
  const [start, setStart] = useState(minutesToTimeInput(lastEnd ?? 17 * 60 + 30));
  const [end, setEnd] = useState(minutesToTimeInput(Math.min((lastEnd ?? 17 * 60 + 30) + 90, 23 * 60)));
  const [length, setLength] = useState("10");
  const [rooms, setRooms] = useState(existingRooms.length ? existingRooms.join(", ") : "Panel A");
  const [busy, setBusy] = useState(false);
  const startMin = timeInputToMinutes(start);
  const endMin = timeInputToMinutes(end);
  const roomList = rooms.split(",").map((room) => room.trim()).filter(Boolean);
  const count =
    Number.isFinite(startMin) && Number.isFinite(endMin) && endMin > startMin
      ? Math.floor((endMin - startMin) / Number(length)) * roomList.length
      : 0;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    const result = await run(
      addSlots({
        roundId: round._id,
        date: day,
        startMinutes: startMin,
        endMinutes: endMin,
        durationMinutes: Number(length),
        rooms: roomList,
        ...creds,
      }),
    );
    setBusy(false);

    if (result) {
      toast.success(result.created ? `Added ${result.created} slots` : "Those slots already exist.");
      onDone();
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-3 rounded-lg border bg-muted/20 p-4 sm:grid-cols-2 lg:grid-cols-[repeat(3,minmax(0,8rem))_minmax(0,1fr)_auto] lg:items-end">
      <Field label="Start">
        <Input type="time" value={start} onChange={(event) => setStart(event.target.value)} step={300} required />
      </Field>
      <Field label="End">
        <Input type="time" value={end} onChange={(event) => setEnd(event.target.value)} step={300} required />
      </Field>
      <Field label="Each interview">
        <select className={selectClass} value={length} onChange={(event) => setLength(event.target.value)}>
          {[5, 8, 10, 12, 15, 20, 25, 30, 45].map((minutes) => (
            <option key={minutes} value={minutes}>
              {minutes} min
            </option>
          ))}
        </select>
      </Field>
      <Field label="Rooms or panels running at once" hint="Comma-separated">
        <Input value={rooms} onChange={(event) => setRooms(event.target.value)} placeholder="Panel A, Panel B" />
      </Field>
      <div className="flex gap-2">
        <Button type="submit" disabled={busy || count === 0}>
          Add {count || ""} slots
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="grid min-w-0 gap-1.5">
      <Label className="text-xs">
        {label}
        {hint && <span className="font-normal text-muted-foreground"> · {hint}</span>}
      </Label>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Candidates
// ---------------------------------------------------------------------------

function CandidatePanel({
  round,
  candidates,
  slotByCandidate,
  roomCount,
  selectedId,
  onSelect,
  creds,
  applicants,
  onReviewKey,
  onImport,
  followUp,
  day,
}: {
  round: Round;
  candidates: Candidate[];
  slotByCandidate: Map<Id<"interviewCandidates">, Slot>;
  roomCount: number;
  selectedId: Id<"interviewCandidates"> | null;
  onSelect: (id: Id<"interviewCandidates"> | null) => void;
  creds: Creds;
  applicants: ReturnType<typeof useApplicantIndex>;
  onReviewKey: () => void;
  onImport: () => void;
  followUp: number;
  /** The day open on the board: students free that day sort to the top. */
  day: string;
}) {
  const [filter, setFilter] = useState<Filter>("todo");
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<Id<"interviewCandidates"> | null>(null);
  const needle = search.trim().toLowerCase();

  const counts = {
    todo: candidates.filter((c) => !c.withdrawn && !slotByCandidate.has(c._id)).length,
    scheduled: candidates.filter((c) => !c.withdrawn && slotByCandidate.has(c._id)).length,
    all: candidates.filter((c) => !c.withdrawn).length,
    withdrawn: candidates.filter((c) => c.withdrawn).length,
  };

  const visible = candidates
    .filter((c) => {
      if (filter === "withdrawn") return c.withdrawn;
      if (c.withdrawn) return false;
      if (filter === "todo") return !slotByCandidate.has(c._id);
      if (filter === "scheduled") return slotByCandidate.has(c._id);
      return true;
    })
    .filter((c) => !needle || c.name.toLowerCase().includes(needle) || c.email?.includes(needle))
    .sort((a, b) => {
      const freeA = a.availableDates.includes(day) ? 0 : 1;
      const freeB = b.availableDates.includes(day) ? 0 : 1;
      return (
        freeA - freeB ||
        (filter === "todo" ? a.availableDates.length - b.availableDates.length : 0) ||
        a.name.localeCompare(b.name)
      );
    });
  const freeCount = day ? visible.filter((c) => c.availableDates.includes(day)).length : visible.length;

  return (
    <Card className="h-fit overflow-hidden py-0 xl:sticky xl:top-20">
      <CardHeader className="border-b bg-muted/25 px-4 py-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle>Students</CardTitle>
            <CardDescription>
              Students free on {day ? formatDay(day) : "the selected day"} come first. Click a name to place them.
            </CardDescription>
          </div>
          <Button size="sm" variant="outline" onClick={onImport}>
            <FileUp className="size-4" /> Import
          </Button>
        </div>
        <div className="relative mt-3">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search students"
            className="h-9 pl-8"
            aria-label="Search students"
          />
        </div>
        <div className="mt-2 grid grid-cols-4 gap-1 rounded-lg bg-muted p-1 text-xs">
          {(
            [
              ["todo", "To place"],
              ["scheduled", "Placed"],
              ["all", "All"],
              ["withdrawn", "Out"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
              className={cn(
                "rounded-md px-1 py-1.5 font-medium text-muted-foreground transition-colors",
                filter === value && "bg-card text-foreground shadow-xs",
              )}
            >
              {label} <span className="tabular-nums opacity-70">{counts[value]}</span>
            </button>
          ))}
        </div>
        {followUp > 0 && filter !== "withdrawn" && (
          <p className="mt-2 text-xs text-warning">
            {followUp} student{followUp === 1 ? "" : "s"} didn't pick any listed day. Their note is shown; add days by hand once you hear back.
          </p>
        )}
      </CardHeader>
      <CardContent className="max-h-[70vh] space-y-1 overflow-y-auto px-2 py-2">
        <ReviewConnect applicants={applicants} onReviewKey={onReviewKey} />
        {visible.length === 0 && (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            {filter === "todo" && !needle ? "Everyone has a time." : "Nobody here."}
          </p>
        )}
        {visible.map((candidate, index) => (
          <Fragment key={candidate._id}>
            {day && index === 0 && freeCount > 0 && (
              <ListDivider tone="free">
                Free {formatDay(day)} · {freeCount}
              </ListDivider>
            )}
            {day && index === freeCount && (
              <ListDivider>
                Didn't pick {formatDay(day)} · {visible.length - freeCount}
              </ListDivider>
            )}
            <CandidateRow
              key={candidate._id}
              round={round}
              candidate={candidate}
              slot={slotByCandidate.get(candidate._id)}
              roomCount={roomCount}
              selected={selectedId === candidate._id}
              expanded={openId === candidate._id}
              onSelect={() => onSelect(selectedId === candidate._id ? null : candidate._id)}
              onToggle={() => setOpenId(openId === candidate._id ? null : candidate._id)}
              creds={creds}
              applicant={applicants.status === "ready" ? applicants.match?.(candidate.name) ?? null : undefined}
              reviewKey={applicants.key}
            />
          </Fragment>
        ))}
      </CardContent>
    </Card>
  );
}

function ListDivider({ tone, children }: { tone?: "free"; children: ReactNode }) {
  return (
    <div
      className={cn(
        "sticky top-0 z-10 mx-1 mt-2 mb-1 rounded-md bg-card/95 px-2 py-1 text-xs font-semibold backdrop-blur",
        tone === "free" ? "text-primary" : "text-muted-foreground",
      )}
    >
      {children}
    </div>
  );
}

export function ReviewConnect({
  applicants,
  onReviewKey,
}: {
  applicants: ReturnType<typeof useApplicantIndex>;
  onReviewKey: () => void;
}) {
  const [link, setLink] = useState("");

  if (applicants.status === "ready" || applicants.status === "loading") {
    return null;
  }

  return (
    <form
      className="mx-1 mb-2 grid gap-2 rounded-md border border-dashed p-3 text-xs text-muted-foreground"
      onSubmit={(event) => {
        event.preventDefault();
        const key = reviewKeyFromLink(link);
        if (key) {
          saveReviewKey(key);
          setLink("");
          onReviewKey();
        }
      }}
    >
      <span>
        <Link2 className="mr-1 inline size-3.5" />
        {applicants.status === "error"
          ? "Couldn't open the applicant files with the saved link. Paste the current applicant review link:"
          : "Paste the applicant review link once to link each student to their application:"}
      </span>
      <div className="flex gap-2">
        <Input value={link} onChange={(event) => setLink(event.target.value)} placeholder={`…${REVIEW_PAGE_PATH}#…`} className="h-8 text-xs" />
        <Button size="sm" type="submit" variant="outline" disabled={!link.trim()}>
          Link
        </Button>
      </div>
    </form>
  );
}

function CandidateRow({
  round,
  candidate,
  slot,
  roomCount,
  selected,
  expanded,
  onSelect,
  onToggle,
  creds,
  applicant,
  reviewKey,
}: {
  round: Round;
  candidate: Candidate;
  slot?: Slot;
  roomCount: number;
  selected: boolean;
  expanded: boolean;
  onSelect: () => void;
  onToggle: () => void;
  creds: Creds;
  /** undefined = applicant files not connected; null = no match. */
  applicant?: ApplicantLink | null;
  reviewKey?: string;
}) {
  const conflict = slot && !candidate.availableDates.includes(slot.date);

  return (
    <div
      className={cn(
        "rounded-md border border-transparent",
        selected && "border-primary/50 bg-primary/5",
        expanded && !selected && "border-border bg-muted/30",
      )}
    >
      <div className="flex items-start gap-2 px-2 py-2">
        <button type="button" onClick={onSelect} className="min-w-0 flex-1 text-left" aria-pressed={selected}>
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium">{candidate.name}</span>
            {candidate.availableDates.length === 0 && !candidate.withdrawn && (
              <Badge variant="outline" className="border-warning/50 text-warning">Follow up</Badge>
            )}
          </div>
          <div className="mt-1 flex flex-wrap gap-0.5" aria-label="Days picked">
            {round.dates.map((date) => {
              const isFree = candidate.availableDates.includes(date);
              const isSlot = slot?.date === date;
              return (
                <span
                  key={date}
                  title={`${formatDay(date)}${isFree ? " · picked" : " · not picked"}${isSlot ? " · interview" : ""}`}
                  className={cn(
                    "flex h-5 min-w-6 items-center justify-center rounded-sm px-1 font-mono text-[10px] tabular-nums",
                    isFree ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground/50",
                    isSlot && (isFree ? "bg-primary text-primary-foreground" : "bg-warning text-white"),
                  )}
                >
                  {dayNumber(date)}
                </span>
              );
            })}
          </div>
          <div className={cn("mt-1 text-xs", conflict ? "text-warning" : "text-muted-foreground")}>
            {slot ? `${slotLabel(slot, roomCount)}${conflict ? " · didn't pick this day" : ""}` : candidate.withdrawn ? "Withdrawn" : "Not placed"}
          </div>
          {candidate.availabilityNote && (
            <div className="mt-1 line-clamp-2 text-xs italic text-muted-foreground">“{candidate.availabilityNote}”</div>
          )}
        </button>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {applicant && reviewKey && (
            <a
              href={reviewLink(reviewKey, applicant.id)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              title="Open their application"
            >
              App{applicant.critical ? <span className="size-1.5 rounded-full bg-destructive" /> : null}
              <ExternalLink className="size-3" />
            </a>
          )}
          {applicant === null && <span className="text-[11px] text-muted-foreground" title="No application with this name">No app</span>}
          <button type="button" onClick={onToggle} className="text-xs text-muted-foreground hover:text-foreground" aria-expanded={expanded}>
            {expanded ? "Close" : "Edit"}
          </button>
        </div>
      </div>
      {expanded && <CandidateEditor round={round} candidate={candidate} creds={creds} onClose={onToggle} />}
    </div>
  );
}

function CandidateEditor({
  round,
  candidate,
  creds,
  onClose,
}: {
  round: Round;
  candidate: Candidate;
  creds: Creds;
  onClose: () => void;
}) {
  const update = useMutation(api.interviews.updateCandidate);
  const remove = useMutation(api.interviews.deleteCandidate);
  const [name, setName] = useState(candidate.name);
  const [note, setNote] = useState(candidate.mentorNote ?? "");

  function toggleDate(date: string) {
    const next = candidate.availableDates.includes(date)
      ? candidate.availableDates.filter((d) => d !== date)
      : [...candidate.availableDates, date];
    void run(update({ candidateId: candidate._id, availableDates: next, ...creds }));
  }

  return (
    <div className="space-y-3 border-t px-3 py-3">
      <Field label="Name">
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          onBlur={() => name.trim() && name.trim() !== candidate.name && void run(update({ candidateId: candidate._id, name, ...creds }))}
          className="h-8"
        />
      </Field>
      <div className="grid gap-1.5">
        <Label className="text-xs">Days they can do</Label>
        <div className="flex flex-wrap gap-1">
          {round.dates.map((date) => {
            const on = candidate.availableDates.includes(date);
            return (
              <button
                key={date}
                type="button"
                aria-pressed={on}
                onClick={() => toggleDate(date)}
                className={cn(
                  "rounded-md border px-2 py-1 text-xs",
                  on ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-accent",
                )}
              >
                {formatDay(date)}
              </button>
            );
          })}
        </div>
      </div>
      {candidate.email && (
        <p className="text-xs text-muted-foreground">
          <a href={`mailto:${candidate.email}`} className="hover:underline">{candidate.email}</a>
        </p>
      )}
      <Field label="Mentor note" hint="Only mentors see this">
        <Textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          onBlur={() => note !== (candidate.mentorNote ?? "") && void run(update({ candidateId: candidate._id, mentorNote: note, ...creds }))}
          rows={2}
          className="text-sm"
        />
      </Field>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            void run(
              update({ candidateId: candidate._id, withdrawn: !candidate.withdrawn, ...creds }),
              candidate.withdrawn ? `${candidate.name} is back on the list` : `${candidate.name} marked withdrawn`,
            )
          }
        >
          {candidate.withdrawn ? "Put back on list" : "Mark withdrawn"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="text-destructive"
          onClick={() => {
            if (window.confirm(`Delete ${candidate.name}? Use this for duplicates or test rows.`)) {
              void run(remove({ candidateId: candidate._id, ...creds }), "Deleted");
              onClose();
            }
          }}
        >
          <Trash2 className="size-4" /> Delete
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

function useImporter(round: Round, creds: Creds) {
  const importResponses = useMutation(api.interviews.importResponses);
  const [rows, setRows] = useState<ImportRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function load(text: string) {
    try {
      setRows(parseAvailabilityCsv(text, round.dates));
      setError(null);
    } catch (err) {
      setRows(null);
      setError(err instanceof Error ? err.message : "Couldn't read that file.");
    }
  }

  async function commit() {
    if (!rows) return false;
    setBusy(true);
    const result = await run(importResponses({ roundId: round._id, rows, ...creds }));
    setBusy(false);

    if (result) {
      toast.success(
        `${result.added} added, ${result.updated} updated${result.unchanged ? `, ${result.unchanged} already here` : ""}`,
      );
      setRows(null);
      return true;
    }

    return false;
  }

  return { rows, error, busy, load, commit, reset: () => setRows(null) };
}

function ImportDrop({ importer }: { importer: ReturnType<typeof useImporter> }) {
  const [dragging, setDragging] = useState(false);

  async function readFile(file?: File) {
    if (file) importer.load(await file.text());
  }

  return (
    <label
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        void readFile(event.dataTransfer.files[0]);
      }}
      className={cn(
        "flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed px-4 py-8 text-center text-sm transition-colors",
        dragging ? "border-primary bg-primary/5" : "hover:bg-muted/40",
      )}
    >
      <FileUp className="size-6 text-muted-foreground" />
      <span className="font-medium">Drop the form's response CSV here, or click to choose it</span>
      <span className="text-xs text-muted-foreground">Google Sheets: File › Download › Comma-separated values</span>
      <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(event) => void readFile(event.target.files?.[0])} />
    </label>
  );
}

function ImportPreview({ round, importer }: { round: Round; importer: ReturnType<typeof useImporter> }) {
  if (importer.error) {
    return <p className="text-sm text-destructive">{importer.error}</p>;
  }

  if (!importer.rows) {
    return null;
  }

  const noDays = importer.rows.filter((row) => row.dates.length === 0);
  const withNotes = importer.rows.filter((row) => row.note);

  return (
    <div className="space-y-3 rounded-lg border p-4 text-sm">
      <p className="font-medium">
        {importer.rows.length} responses. Students free each day:{" "}
        <span className="font-normal text-muted-foreground">
          {round.dates.map((date) => `${formatDay(date)} ${importer.rows!.filter((row) => row.dates.includes(date)).length}`).join(" · ")}
        </span>
      </p>
      {noDays.length > 0 && (
        <p className="text-warning">
          No listed day picked: {noDays.map((row) => row.name).join(", ")}. They'll come in marked "Follow up".
        </p>
      )}
      {withNotes.length > 0 && (
        <details>
          <summary className="cursor-pointer text-muted-foreground">{withNotes.length} wrote something other than a date</summary>
          <ul className="mt-2 space-y-1 text-xs">
            {withNotes.map((row) => (
              <li key={row.name}>
                <b>{row.name}:</b> {row.note}
              </li>
            ))}
          </ul>
        </details>
      )}
      <div className="flex gap-2">
        <Button onClick={() => void importer.commit()} disabled={importer.busy}>
          Import {importer.rows.length} students
        </Button>
        <Button variant="ghost" onClick={importer.reset}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function EmptyImport({ round, creds }: { round: Round; creds: Creds }) {
  const importer = useImporter(round, creds);

  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader>
        <CardTitle>Start with the availability form</CardTitle>
        <CardDescription>
          Import the Google Form responses. Each student comes in with the days they picked. Importing again later adds new
          responses and skips anyone already here.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ImportDrop importer={importer} />
        <ImportPreview round={round} importer={importer} />
      </CardContent>
    </Card>
  );
}

function ImportSheet({
  open,
  onOpenChange,
  round,
  creds,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  round: Round;
  creds: Creds;
}) {
  const importer = useImporter(round, creds);
  const addCandidate = useMutation(api.interviews.addCandidate);
  const [name, setName] = useState("");
  const [days, setDays] = useState<string[]>([]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Add students</SheetTitle>
          <SheetDescription>
            Re-import the response CSV whenever new answers come in. Students already on the board keep their slots; anyone
            who resubmitted gets their new days.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-6 px-4 pb-6">
          <div className="space-y-3">
            <ImportDrop importer={importer} />
            <ImportPreview round={round} importer={importer} />
          </div>
          <form
            className="space-y-3 border-t pt-5"
            onSubmit={async (event) => {
              event.preventDefault();
              const id = await run(addCandidate({ roundId: round._id, name, availableDates: days, ...creds }), `${name.trim()} added`);
              if (id) {
                setName("");
                setDays([]);
              }
            }}
          >
            <h3 className="flex items-center gap-2 font-heading font-semibold">
              <UserPlus className="size-4" /> Add one student by hand
            </h3>
            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Full name" />
            <div className="flex flex-wrap gap-1">
              {round.dates.map((date) => (
                <button
                  key={date}
                  type="button"
                  aria-pressed={days.includes(date)}
                  onClick={() => setDays(days.includes(date) ? days.filter((d) => d !== date) : [...days, date])}
                  className={cn(
                    "rounded-md border px-2 py-1 text-xs",
                    days.includes(date) ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground",
                  )}
                >
                  {formatDay(date)}
                </button>
              ))}
            </div>
            <Button type="submit" variant="outline" disabled={!name.trim()}>
              Add student
            </Button>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Publish
// ---------------------------------------------------------------------------

function PublishSheet({
  open,
  onOpenChange,
  round,
  creds,
  pendingChanges,
  unplaced,
  hasSlots,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  round: Round;
  creds: Creds;
  pendingChanges: number;
  unplaced: number;
  hasSlots: boolean;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Publish the schedule</SheetTitle>
          <SheetDescription>
            Students see a snapshot of the board at the moment you publish. Keep editing afterward; nothing changes for them
            until you publish again.
          </SheetDescription>
        </SheetHeader>
        {/* Mounted only while open, so the fields start from the saved values each time. */}
        <PublishForm
          round={round}
          creds={creds}
          pendingChanges={pendingChanges}
          unplaced={unplaced}
          hasSlots={hasSlots}
          onDone={() => onOpenChange(false)}
        />
      </SheetContent>
    </Sheet>
  );
}

function PublishForm({
  round,
  creds,
  pendingChanges,
  unplaced,
  hasSlots,
  onDone,
}: {
  round: Round;
  creds: Creds;
  pendingChanges: number;
  unplaced: number;
  hasSlots: boolean;
  onDone: () => void;
}) {
  const updateRound = useMutation(api.interviews.updateRound);
  const publish = useMutation(api.interviews.publish);
  const unpublish = useMutation(api.interviews.unpublish);
  const [location, setLocation] = useState(round.location ?? "");
  const [message, setMessage] = useState(round.publicMessage ?? "");
  const [busy, setBusy] = useState(false);

  async function doPublish() {
    setBusy(true);

    try {
      await updateRound({ roundId: round._id, location, publicMessage: message, ...creds });
      const result = await publish({ roundId: round._id, ...creds });
      toast.success(`Published ${result.posted} interview times`);
      onDone();
    } catch (error) {
      toast.error(friendlyError(error));
    } finally {
      setBusy(false);
    }
  }

  const publicUrl = `${window.location.origin}/interviews/schedule`;

  return (
    <div className="space-y-5 px-4 pb-6">
      <Field label="Where" hint="Shown at the top">
        <Input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="e.g. Room 1101 (robotics room)" />
      </Field>
      <Field label="Message to students">
        <Textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          rows={4}
          placeholder="e.g. Arrive 5 minutes early. Bring nothing but yourself. Can't make your time? Email Mr. Eves."
        />
      </Field>
      <div className="grid gap-1.5">
        <Label className="text-xs">Names on the public page</Label>
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1 text-sm">
          {(
            [
              ["full", "Full name"],
              ["initial", "First name + last initial"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={round.publicNameStyle === value}
              onClick={() => void run(updateRound({ roundId: round._id, publicNameStyle: value, ...creds }))}
              className={cn(
                "rounded-md px-2 py-1.5 font-medium text-muted-foreground",
                round.publicNameStyle === value && "bg-card text-foreground shadow-xs",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">The page has no login, so anyone with the link can read it. Emails and notes are never shown.</p>
      </div>

      <div className="space-y-2 rounded-lg border bg-muted/20 p-4 text-sm">
        {!hasSlots && <p className="text-warning">There are no slots yet.</p>}
        {unplaced > 0 && <p className="text-warning">{unplaced} student{unplaced === 1 ? " is" : "s are"} not placed yet and won't be on the schedule.</p>}
        {round.published ? (
          <p>
            Last published {new Date(round.published.at).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} by{" "}
            {round.published.by}. {pendingChanges ? `${pendingChanges} change${pendingChanges === 1 ? "" : "s"} since then.` : "No changes since."}
          </p>
        ) : (
          <p>Not published yet.</p>
        )}
        <div className="flex flex-wrap gap-2 pt-1">
          <Button variant="cta" onClick={() => void doPublish()} disabled={busy}>
            <Megaphone className="size-4" /> {round.published ? "Publish changes" : "Publish now"}
          </Button>
          {round.published && (
            <Button
              variant="ghost"
              onClick={() => {
                if (window.confirm("Take the public schedule down? Students will see \"not posted yet\".")) {
                  void run(unpublish({ roundId: round._id, ...creds }), "Schedule taken down");
                }
              }}
            >
              Take down
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-2 text-sm">
        <Label className="text-xs">Link for students</Label>
        <div className="flex gap-2">
          <Input readOnly value={publicUrl} onFocus={(event) => event.target.select()} className="font-mono text-xs" />
          <Button
            variant="outline"
            onClick={() => {
              void navigator.clipboard.writeText(publicUrl).then(
                () => toast.success("Copied"),
                () => window.prompt("Copy:", publicUrl),
              );
            }}
          >
            Copy
          </Button>
        </div>
      </div>
    </div>
  );
}
