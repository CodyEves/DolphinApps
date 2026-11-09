import { useQuery } from "convex/react";
import { CalendarClock, MapPin, Search } from "lucide-react";
import { useState } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageSkeleton } from "@/components/ui/skeleton";
import { INTERVIEW_ROUND_SLUG, formatDay, formatTime, formatTimeRange, todayIso } from "@/lib/interviews";
import { cn } from "@/lib/utils";
import { api } from "@convex/_generated/api";

/** Public interview schedule. No login: shows only what mentors last published. */
export function InterviewSchedulePage() {
  const data = useQuery(api.interviews.publicSchedule, { slug: INTERVIEW_ROUND_SLUG });
  const [search, setSearch] = useState("");

  if (data === undefined) {
    return <PageSkeleton />;
  }

  const published = data?.published;
  const title = data?.title ?? "Interviews";

  if (!published || published.slots.length === 0) {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-6 font-heading text-[1.75rem] leading-tight font-bold sm:text-[2rem]">{title}</h1>
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <CalendarClock className="size-8 text-muted-foreground" />
            <p className="font-heading text-lg font-semibold">The interview schedule isn't posted yet</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Mentors are still putting it together. Check back here; your time will show up once it's published.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const needle = search.trim().toLowerCase();
  const today = todayIso();
  const rooms = new Set(published.slots.map((slot) => slot.room));
  const showRoom = rooms.size > 1;
  const dates = [...new Set(published.slots.map((slot) => slot.date))].sort();
  const matches = needle ? published.slots.filter((slot) => slot.name.toLowerCase().includes(needle)) : [];

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 space-y-3">
        <h1 className="font-heading text-[1.75rem] leading-tight font-bold sm:text-[2rem]">{title}</h1>
        {published.location && (
          <p className="flex items-center gap-2 text-base font-medium">
            <MapPin className="size-4 text-primary" /> {published.location}
          </p>
        )}
        {published.message && (
          <p className="max-w-[65ch] text-base leading-7 whitespace-pre-line text-muted-foreground">{published.message}</p>
        )}
        <p className="text-xs text-muted-foreground">
          Posted {new Date(published.at).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
        </p>
      </div>

      <div className="relative mb-6">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Find your name"
          aria-label="Find your name"
          className="h-11 pl-9 text-base"
        />
      </div>

      {needle && (
        <div className="mb-6 rounded-lg border border-primary/30 bg-primary/5 p-4" aria-live="polite">
          {matches.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No one by that name on the schedule. Try your first name, or ask a mentor.
            </p>
          ) : (
            <ul className="space-y-2">
              {matches.map((slot) => (
                <li key={`${slot.date}-${slot.startMinutes}-${slot.room}`}>
                  <p className="font-heading text-lg font-bold">{slot.name}</p>
                  <p className="text-base">
                    {formatDay(slot.date, "long")}, {formatTimeRange(slot.startMinutes, slot.durationMinutes)}
                    {showRoom && ` · ${slot.room}`}
                    {slot.note && <span className="text-muted-foreground"> · {slot.note}</span>}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="space-y-6">
        {dates.map((date) => {
          const daySlots = published.slots.filter((slot) => slot.date === date);
          return (
            <section key={date} className={cn(date < today && "opacity-60")}>
              <h2 className="mb-2 flex items-baseline justify-between gap-2 border-b pb-2 font-heading text-lg font-semibold">
                {formatDay(date, "long")}
                <span className="text-xs font-normal text-muted-foreground">
                  {date < today ? "Done" : `${daySlots.length} interview${daySlots.length === 1 ? "" : "s"}`}
                </span>
              </h2>
              <ul className="divide-y">
                {daySlots.map((slot) => {
                  const hit = needle && slot.name.toLowerCase().includes(needle);
                  return (
                    <li
                      key={`${slot.startMinutes}-${slot.room}`}
                      className={cn(
                        "grid grid-cols-[4.5rem_minmax(0,1fr)] gap-3 py-2.5 text-sm sm:grid-cols-[9rem_minmax(0,1fr)_auto]",
                        hit && "-mx-2 rounded-md bg-primary/10 px-2",
                      )}
                    >
                      <span className="font-mono text-xs leading-5 whitespace-nowrap text-muted-foreground tabular-nums">
                        <span className="sm:hidden">{formatTime(slot.startMinutes)}</span>
                        <span className="hidden sm:inline">{formatTimeRange(slot.startMinutes, slot.durationMinutes)}</span>
                      </span>
                      <span className="min-w-0">
                        <span className="font-medium">{slot.name}</span>
                        {slot.note && <span className="text-muted-foreground"> · {slot.note}</span>}
                      </span>
                      {showRoom && (
                        <span className="col-start-2 text-xs text-muted-foreground sm:col-start-auto sm:text-sm">
                          {slot.room}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
