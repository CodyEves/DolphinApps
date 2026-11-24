import { useConvexAuth } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Check, CheckCheck, ClipboardCopy, Download, ExternalLink, RotateCcw, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

import { PageHeading } from "@/components/page-heading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageSkeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { findSop, kindLabel, sopHref, SOP_HOME } from "@/lib/sop-book";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/pages/sop-page";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";

type Row = NonNullable<FunctionReturnType<typeof api.sopSuggestions.listAll>>[number];
type Status = Row["status"];

const filters: { value: Status | "all"; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "accepted", label: "Accepted" },
  { value: "rejected", label: "Rejected" },
  { value: "done", label: "Done" },
  { value: "all", label: "All" },
];

const statusLabel: Record<Status, string> = {
  open: "Open",
  accepted: "Accepted",
  rejected: "Rejected",
  done: "Done",
};

const statusVariant: Record<Status, "warning" | "success" | "secondary" | "outline"> = {
  open: "warning",
  accepted: "success",
  rejected: "secondary",
  done: "outline",
};

const dateFormat = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" });

function quoteBlock(text: string) {
  return text
    .split("\n")
    .map((line) => `   > ${line}`)
    .join("\n");
}

/** Markdown a mentor pastes into the Claude project to apply the accepted suggestions. */
export function exportForClaude(rows: Row[]) {
  const bySop = new Map<string, Row[]>();
  for (const row of rows) {
    bySop.set(row.sopId, [...(bySop.get(row.sopId) ?? []), row]);
  }
  const ids = [...bySop.keys()].sort();
  const lines = [
    "# SOP suggestions to apply",
    "",
    `Exported ${dateFormat.format(new Date())} from apps.robotdolphins.org/SOP/suggestions: ${rows.length} accepted suggestion${rows.length === 1 ? "" : "s"} on ${ids.length} SOP${ids.length === 1 ? "" : "s"}.`,
    "",
    "Apply each one to sops/source/<SOP ID>.md in the DolphinApps repo, rebuild with `python3 sops/build.py web`, add a Revision history row to every SOP you change, and list any suggestion you couldn't apply (by ID) with the reason.",
  ];

  for (const sopId of ids) {
    const items = bySop.get(sopId)!;
    const sop = findSop(sopId);
    lines.push("", `## ${sopId} · ${sop?.title ?? items[0].sopTitle} (page v${sop?.version ?? items[0].sopVersion})`);
    items
      .sort((a, b) => a.createdAt - b.createdAt)
      .forEach((row, index) => {
        lines.push(
          "",
          `${index + 1}. **${kindLabel(row.kind)}** at "${row.anchorLabel}" (block ${row.anchorId}, suggested on page v${row.sopVersion})`,
          quoteBlock(row.quote),
          `   Suggestion: ${row.comment.replace(/\n+/g, " / ")}`,
          `   From ${row.authorName}, ${dateFormat.format(new Date(row.createdAt))}${row.reviewNote ? `. Reviewer note: ${row.reviewNote}` : ""}`,
          `   ID: ${row._id}`,
        );
      });
  }

  return `${lines.join("\n")}\n`;
}

export function SopSuggestionsPage() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const [filter, setFilter] = useState<Status | "all">("open");
  const [needle, setNeedle] = useState("");
  const rows = useQuery(api.sopSuggestions.listAll, isAuthenticated ? (filter === "all" ? {} : { status: filter }) : "skip");
  const accepted = useQuery(api.sopSuggestions.listAll, isAuthenticated ? { status: "accepted" } : "skip");
  const setStatus = useMutation(api.sopSuggestions.setStatus);
  const [confirmDone, setConfirmDone] = useState(false);

  const visible = useMemo(() => {
    const terms = needle.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!rows || terms.length === 0) return rows ?? [];
    return rows.filter((row) => {
      const haystack = [row.sopId, row.sopTitle, row.anchorLabel, row.quote, row.comment, row.authorName]
        .join(" ")
        .toLowerCase();
      return terms.every((term) => haystack.includes(term));
    });
  }, [rows, needle]);

  const groups = useMemo(() => {
    const map = new Map<string, Row[]>();
    for (const row of visible) map.set(row.sopId, [...(map.get(row.sopId) ?? []), row]);
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [visible]);

  if (isLoading || (isAuthenticated && rows === undefined)) {
    return <PageSkeleton />;
  }

  if (!isAuthenticated || rows === null) {
    return (
      <div className="mx-auto max-w-xl py-10 text-center">
        <h1 className="mb-2 text-2xl font-semibold">Suggestions log</h1>
        <p className="mb-6 text-muted-foreground">
          {isAuthenticated
            ? "Only mentors, instructors and admins can review SOP suggestions."
            : "Sign in with a mentor account to review SOP suggestions."}
        </p>
        <div className="flex justify-center gap-2">
          <Button asChild variant="outline">
            <Link to={SOP_HOME}>Back to the SOP book</Link>
          </Button>
          {!isAuthenticated && (
            <Button asChild>
              <Link to={`/auth?returnTo=${encodeURIComponent("/SOP/suggestions")}`}>Sign in</Link>
            </Button>
          )}
        </div>
      </div>
    );
  }

  const acceptedRows = accepted ?? [];

  async function update(ids: Id<"sopSuggestions">[], status: Status, note?: string) {
    try {
      await setStatus({ suggestionIds: ids, status, note });
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message.split("\n")[0] : "That didn't save.");
      return false;
    }
  }

  async function copyForClaude() {
    if (acceptedRows.length === 0) {
      toast.message("Nothing accepted yet", { description: "Accept suggestions first, then copy them for Claude." });
      return;
    }
    try {
      await navigator.clipboard.writeText(exportForClaude(acceptedRows));
      toast.success(`Copied ${acceptedRows.length} accepted suggestion${acceptedRows.length === 1 ? "" : "s"}`, {
        description: 'Paste into the Claude project "RDOS SOP Creation" with "Apply these SOP suggestions."',
      });
    } catch {
      toast.error("Your browser blocked the clipboard. Use Download instead.");
    }
  }

  function download() {
    const source = acceptedRows.length > 0 ? acceptedRows : visible;
    const blob = new Blob([exportForClaude(source)], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `sop-suggestions-${new Date().toISOString().slice(0, 10)}.md`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function markAllDone() {
    const ok = await update(
      acceptedRows.map((row) => row._id),
      "done",
    );
    if (ok) toast.success(`Marked ${acceptedRows.length} suggestion${acceptedRows.length === 1 ? "" : "s"} done`);
    setConfirmDone(false);
  }

  return (
    <div className="mx-auto max-w-[75rem]">
      <PageHeading
        title="SOP suggestions"
        description="Everything team members have suggested on the SOP book. Accept or reject each one, copy the accepted ones for Claude, then mark them done once the rebuilt pages are live."
        actions={
          <>
            <Button onClick={() => void copyForClaude()}>
              <ClipboardCopy />
              Copy for Claude
              <Badge className="pointer-events-none bg-white/20 text-white">{acceptedRows.length}</Badge>
            </Button>
            <Button variant="outline" onClick={download}>
              <Download />
              Download
            </Button>
          </>
        }
      />

      {acceptedRows.length > 0 && (
        <Card className="mb-6">
          <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm">
              <span className="font-semibold">{acceptedRows.length} accepted</span>{" "}
              <span className="text-muted-foreground">
                waiting for Claude. After the rebuild is published, mark them done.
              </span>
            </p>
            {confirmDone ? (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setConfirmDone(false)}>
                  Cancel
                </Button>
                <Button size="sm" onClick={() => void markAllDone()}>
                  Yes, the new pages are live
                </Button>
              </div>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setConfirmDone(true)}>
                <CheckCheck />
                Mark accepted as done
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div role="tablist" aria-label="Status" className="flex flex-wrap gap-1.5">
          {filters.map((item) => (
            <button
              key={item.value}
              type="button"
              role="tab"
              aria-selected={filter === item.value}
              onClick={() => setFilter(item.value)}
              className={cn(
                "h-9 rounded-full border px-4 text-sm font-medium outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/45",
                filter === item.value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input bg-card hover:border-primary/40",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
        <label className="relative block w-full sm:max-w-xs">
          <span className="sr-only">Filter suggestions</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            type="search"
            value={needle}
            onChange={(event) => setNeedle(event.target.value)}
            placeholder="SOP, words or name"
            className="pl-9"
          />
        </label>
      </div>

      {groups.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {needle ? "No suggestions match that filter." : `No ${filter === "all" ? "" : `${statusLabel[filter].toLowerCase()} `}suggestions.`}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {groups.map(([sopId, items]) => {
            const sop = findSop(sopId);
            return (
              <section key={sopId} aria-labelledby={`g-${sopId}`}>
                <header className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                  <h2 id={`g-${sopId}`} className="text-lg">
                    <span className="mr-2 font-mono text-sm text-muted-foreground">{sopId}</span>
                    {sop?.title ?? items[0].sopTitle}
                  </h2>
                  <span className="text-xs text-muted-foreground">
                    {items.length} suggestion{items.length === 1 ? "" : "s"}
                    {sop ? ` · page v${sop.version}` : " · no longer in the book"}
                  </span>
                </header>
                <ul className="space-y-3">
                  {items.map((row) => (
                    <SuggestionItem key={row._id} row={row} onUpdate={update} />
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SuggestionItem({
  row,
  onUpdate,
}: {
  row: Row;
  onUpdate: (ids: Id<"sopSuggestions">[], status: Status, note?: string) => Promise<boolean>;
}) {
  const sop = findSop(row.sopId);
  const [noting, setNoting] = useState<null | Status>(null);
  const [note, setNote] = useState(row.reviewNote ?? "");
  const [busy, setBusy] = useState(false);

  async function act(status: Status, withNote?: string) {
    setBusy(true);
    const ok = await onUpdate([row._id], status, withNote);
    setBusy(false);
    if (ok) setNoting(null);
  }

  return (
    <li className="rounded-lg border bg-card shadow-card">
      <div className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant={statusVariant[row.status]}>{statusLabel[row.status]}</Badge>
            <Badge variant="secondary">{kindLabel(row.kind)}</Badge>
            <span className="text-sm font-medium">{row.anchorLabel}</span>
            {sop && sop.version !== row.sopVersion && (
              <span className="text-xs text-warning">left on v{row.sopVersion}</span>
            )}
          </div>
          <blockquote className="line-clamp-3 border-l-[3px] border-warning/60 pl-3 text-sm text-muted-foreground">
            {row.quote}
          </blockquote>
          <p className="text-[15px] leading-6 whitespace-pre-line">{row.comment}</p>
          <p className="text-xs text-muted-foreground">
            {row.authorName} · {timeAgo(row.createdAt)}
            {row.reviewerName && row.status !== "open" && ` · ${statusLabel[row.status]} by ${row.reviewerName}`}
            {row.reviewNote && <span className="text-foreground"> · Note: {row.reviewNote}</span>}
          </p>
        </div>
        <div className="flex flex-wrap items-start gap-2 md:flex-col md:items-stretch">
          {sop && (
            <Button asChild variant="ghost" size="sm">
              <Link to={`${sopHref(sop)}?a=${encodeURIComponent(row.anchorId)}`}>
                <ExternalLink />
                See on page
              </Link>
            </Button>
          )}
          {row.status === "open" ? (
            <>
              <Button size="sm" disabled={busy} onClick={() => void act("accepted")}>
                <Check />
                Accept
              </Button>
              <Button variant="outline" size="sm" disabled={busy} onClick={() => setNoting("rejected")}>
                <X />
                Reject
              </Button>
            </>
          ) : (
            <Button variant="outline" size="sm" disabled={busy} onClick={() => void act("open")}>
              <RotateCcw />
              Reopen
            </Button>
          )}
          {row.status === "accepted" && (
            <Button variant="outline" size="sm" disabled={busy} onClick={() => setNoting("accepted")}>
              Add note
            </Button>
          )}
        </div>
      </div>
      {noting && (
        <div className="flex flex-col gap-2 border-t p-4 sm:flex-row sm:items-end">
          <label className="min-w-0 flex-1 space-y-1">
            <span className="text-xs font-medium text-muted-foreground">
              {noting === "rejected" ? "Why not? (optional)" : "Note for Claude or the author"}
            </span>
            <Textarea value={note} maxLength={500} onChange={(event) => setNote(event.target.value)} className="min-h-16" />
          </label>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setNoting(null)}>
              Cancel
            </Button>
            <Button size="sm" disabled={busy} onClick={() => void act(noting, note)}>
              {noting === "rejected" ? "Reject" : "Save note"}
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}
