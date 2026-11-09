import { useQuery } from "convex/react";
import { CalendarDays, ExternalLink, MapPin, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageSkeleton } from "@/components/ui/skeleton";
import {
  INTERVIEW_ROUND_SLUG,
  formatDay,
  formatTime,
  formatTimeRange,
  reviewLink,
  todayIso,
  useApplicantIndex,
  useMentorKey,
} from "@/lib/interviews";
import { KeyGate, ReviewConnect } from "@/pages/interviews";
import { cn } from "@/lib/utils";
import { api } from "@convex/_generated/api";

/**
 * Read-only schedule for mentors: full names, application links, panel
 * interviewers and mentor notes. Shows the live board (not only what's
 * published), so it always matches what mentors are planning.
 */
export function InterviewMentorSchedulePage() {
  const mentorKey = useMentorKey();
  const access = useQuery(api.interviews.access, { key: mentorKey.key || undefined });
  const board = useQuery(
    api.interviews.board,
    access?.canEdit ? { slug: INTERVIEW_ROUND_SLUG, key: mentorKey.key || undefined } : "skip",
  );
  const [reviewRefresh, setReviewRefresh] = useState(0);
  const applicants = useApplicantIndex(reviewRefresh);
  const [search, setSearch] = useState("");
  const [showPast, setShowPast] = useState(false);
  const today = todayIso();

  const days = useMemo(() => {
    if (!board) return [];
    const byId = new Map(board.candidates.map((c) => [c._id, c]));
    const rooms = new Set(board.slots.map((s) => s.room));
    const grouped = new Map<string, Array<{ slot: (typeof board.slots)[number]; candidate?: (typeof board.candidates)[number] }>>();

    for (const slot of board.slots) {
      const candidate = slot.candidateId ? byId.get(slot.candidateId) : undefined;
      if (!candidate || candidate.withdrawn) continue;
      const list = grouped.get(slot.date) ?? [];
      list.push({ slot, candidate });
      grouped.set(slot.date, list);
    }

    return [...grouped.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, rows]) => ({
        date,
        rows: rows.sort((a, b) => a.slot.startMinutes - b.slot.startMinutes || a.slot.room.localeCompare(b.slot.room)),
        showRoom: rooms.size > 1,
        panels: board.round.panels.filter((p) => p.date === date),
      }));
  }, [board]);

  if (access === undefined) return <PageSkeleton />;
  if (!access.canEdit) {
    return <KeyGate keyConfigured={access.keyConfigured} hadKey={Boolean(mentorKey.key)} onKey={mentorKey.setKey} />;
  }
  if (!board) return <PageSkeleton />;

  const needle = search.trim().toLowerCase();
  const pastCount = days.filter((d) => d.date < today).length;
  const visibleDays = days
    .filter((d) => showPast || needle || d.date >= today)
    .map((d) => ({ ...d, rows: d.rows.filter((r) => !needle || r.candidate?.name.toLowerCase().includes(needle)) }))
    .filter((d) => d.rows.length > 0);
  const unplaced = board.candidates.filter((c) => !c.withdrawn && !board.slots.some((s) => s.candidateId === c._id));
  const published = board.round.published;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 space-y-3">
        <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Mentor view · read only</p>
        <h1 className="font-heading text-[1.75rem] leading-tight font-bold sm:text-[2rem]">{board.round.title}</h1>
        {board.round.location && (
          <p className="flex items-center gap-2 text-base font-medium">
            <MapPin className="size-4 text-primary" /> {board.round.location}
          </p>
        )}
        <p className="text-sm text-muted-foreground">
          Live from the scheduling board.{" "}
          {published
            ? `Students last saw it ${new Date(published.at).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}.`
            : "Not published to students yet."}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to="/interviews">
              <CalendarDays className="size-4" /> Scheduling board
            </Link>
          </Button>
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Find a student"
            aria-label="Find a student"
            className="h-10 pl-9"
          />
        </div>
        {pastCount > 0 && !needle && (
          <Button variant="ghost" size="sm" onClick={() => setShowPast((v) => !v)}>
            {showPast ? "Hide past days" : `Show past days (${pastCount})`}
          </Button>
        )}
      </div>

      <div className="mb-4">
        <ReviewConnect applicants={applicants} onReviewKey={() => setReviewRefresh((n) => n + 1)} />
      </div>

      {visibleDays.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {needle ? "No scheduled student by that name." : "Nothing scheduled from today on."}
          </CardContent>
        </Card>
      )}

      <div className="space-y-6">
        {visibleDays.map((day) => (
          <section key={day.date} className={cn(day.date < today && "opacity-60")}>
            <h2 className="mb-1 flex items-baseline justify-between gap-2 border-b pb-2 font-heading text-lg font-semibold">
              <span>
                {formatDay(day.date, "long")}
                {day.date === today && <Badge className="ml-2 align-middle">Today</Badge>}
              </span>
              <span className="text-xs font-normal text-muted-foreground">
                {day.rows.length} interview{day.rows.length === 1 ? "" : "s"}
              </span>
            </h2>
            {day.panels.length > 0 && (
              <p className="mb-1 text-xs text-muted-foreground">
                {day.panels.map((p) => (day.showRoom ? `${p.room}: ${p.interviewers}` : `Interviewers: ${p.interviewers}`)).join(" · ")}
              </p>
            )}
            <ul className="divide-y">
              {day.rows.map(({ slot, candidate }) => {
                const app = applicants.status === "ready" && candidate ? applicants.match?.(candidate.name) : undefined;
                const conflict = candidate && !candidate.availableDates.includes(slot.date);
                return (
                  <li key={slot._id} className="grid grid-cols-[4.5rem_minmax(0,1fr)_auto] items-start gap-3 py-3 sm:grid-cols-[9rem_minmax(0,1fr)_auto]">
                    <span className="pt-0.5 font-mono text-xs whitespace-nowrap text-muted-foreground tabular-nums">
                      <span className="sm:hidden">{formatTime(slot.startMinutes)}</span>
                      <span className="hidden sm:inline">{formatTimeRange(slot.startMinutes, slot.durationMinutes)}</span>
                    </span>
                    <div className="min-w-0">
                      <p className="font-medium">{candidate?.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {[day.showRoom ? slot.room : null, slot.note, conflict ? "didn't pick this day" : null].filter(Boolean).join(" · ")}
                      </p>
                      {candidate?.mentorNote && <p className="mt-1 text-xs italic text-muted-foreground">Note: {candidate.mentorNote}</p>}
                    </div>
                    {app && applicants.key ? (
                      <a
                        href={reviewLink(applicants.key, app.id)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium text-primary hover:bg-accent"
                      >
                        Application <ExternalLink className="size-3" />
                      </a>
                    ) : applicants.status === "ready" ? (
                      <span className="pt-1 text-xs text-muted-foreground">No app found</span>
                    ) : (
                      <span />
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      {unplaced.length > 0 && !needle && (
        <p className="mt-8 border-t pt-4 text-sm text-muted-foreground">
          Not scheduled yet: {unplaced.map((c) => c.name).join(", ")}.
        </p>
      )}
    </div>
  );
}
