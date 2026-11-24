import { useConvexAuth } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Check, LogIn, MessageSquareText, Pencil, Send, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, Navigate, useLocation, useParams, useSearchParams } from "react-router";
import { toast } from "sonner";

import { SopDocument, type SopDocumentHandle, type SopPick } from "@/components/sop-book/sop-document";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { PageSkeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  deptHref,
  findDepartment,
  findSop,
  kindLabel,
  loadSopPage,
  sopHref,
  SOP_HOME,
  suggestionKinds,
  type SopEntry,
  type SuggestionKind,
} from "@/lib/sop-book";
import { cn } from "@/lib/utils";
import { Crumbs, SopNotFound } from "@/pages/sop-book";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";

const relative = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

export function timeAgo(timestamp: number) {
  const minutes = Math.round((timestamp - Date.now()) / 60000);
  if (Math.abs(minutes) < 60) return relative.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return relative.format(hours, "hour");
  return relative.format(Math.round(hours / 24), "day");
}

export function SopPage() {
  const { dept: deptParam, sopId } = useParams();
  const location = useLocation();
  const sop = findSop(sopId);

  if (!sop) {
    return <SopNotFound />;
  }

  // Wrong or old section in the address: go to the right one.
  if (findDepartment(deptParam)?.slug !== sop.deptSlug || sopId !== sop.shortId) {
    return <Navigate to={`${sopHref(sop)}${location.search}${location.hash}`} replace />;
  }

  return <SopPageBody key={sop.id} sop={sop} />;
}

function SopPageBody({ sop }: { sop: SopEntry }) {
  const [html, setHtml] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [pick, setPick] = useState<SopPick | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [signInPrompt, setSignInPrompt] = useState(false);
  const [ready, setReady] = useState(false);
  const docRef = useRef<SopDocumentHandle>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const access = useQuery(api.sopSuggestions.viewerAccess, isAuthenticated ? {} : "skip");
  const canSuggest = Boolean(isAuthenticated && access?.canSuggest);
  const suggestions = useQuery(api.sopSuggestions.listForSop, canSuggest ? { sopId: sop.id } : "skip");
  const dept = findDepartment(sop.deptSlug);

  useEffect(() => {
    let cancelled = false;
    loadSopPage(sop.shortId)
      .then((body) => !cancelled && setHtml(body))
      .catch(() => !cancelled && setFailed(true));
    document.title = `${sop.title} · ${sop.shortId} · SOP Book`;

    return () => {
      cancelled = true;
      document.title = "Dolphin Apps";
    };
  }, [sop]);

  const onReady = useCallback(() => setReady(true), []);

  // Arriving from the sign-in page (?suggest=1) or the mentor log (?a=<block>).
  useEffect(() => {
    if (!ready) return;
    const anchor = searchParams.get("a");
    const wantsSuggest = searchParams.get("suggest") === "1";
    if (!anchor && !wantsSuggest) {
      if (location.hash) {
        document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView({ block: "start" });
      }
      return;
    }
    if (wantsSuggest && canSuggest) window.setTimeout(() => setSuggesting(true), 0);
    if (anchor) {
      window.setTimeout(() => {
        if (!docRef.current?.flash(anchor)) {
          toast.message("That spot has moved", { description: "The page was rebuilt since this suggestion was left." });
        }
      }, 50);
    }
    if (anchor || (wantsSuggest && canSuggest) || (wantsSuggest && !isLoading && !isAuthenticated)) {
      const next = new URLSearchParams(searchParams);
      next.delete("a");
      next.delete("suggest");
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, canSuggest, isLoading, isAuthenticated]);

  const marked = useMemo(
    () => (suggesting || panelOpen ? [...new Set((suggestions ?? []).map((row) => row.anchorId))] : []),
    [suggestions, suggesting, panelOpen],
  );

  const onPick = useCallback((next: SopPick) => setPick(next), []);

  function startSuggesting() {
    if (!isAuthenticated) {
      setSignInPrompt(true);
      return;
    }
    if (!canSuggest) {
      toast.error("Your profile is view-only, so you can't leave suggestions. Ask a mentor to turn it on.");
      return;
    }
    setSuggesting(true);
  }

  function stopSuggesting() {
    setSuggesting(false);
    setPick(null);
    window.getSelection()?.removeAllRanges();
  }

  useEffect(() => {
    if (!suggesting) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pick) stopSuggesting();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [suggesting, pick]);

  const openCount = suggestions?.length ?? 0;
  const returnTo = `${location.pathname}?suggest=1`;

  return (
    <div className="-mx-4 -mt-6 -mb-6 sm:-mx-6 sm:-mt-10 sm:-mb-10">
      <div className="border-b bg-card">
        <div className="mx-auto flex max-w-[75rem] flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 pt-3 sm:px-6 [&>nav]:mb-3">
          <Crumbs
            items={[
              { label: "SOP Book", href: SOP_HOME },
              ...(dept ? [{ label: dept.name, href: deptHref(dept) }] : []),
              { label: sop.shortId },
            ]}
          />
          <p className="mb-3 text-xs text-muted-foreground">
            v{sop.version} · {sop.status} · Anyone can read this page
          </p>
        </div>
      </div>

      {failed ? (
        <div className="px-4 py-10 text-center sm:px-6">
          <p className="mb-4 text-muted-foreground">This SOP didn't load. Check your connection and try again.</p>
          <Button variant="outline" onClick={() => window.location.reload()}>
            Reload
          </Button>
        </div>
      ) : html === null ? (
        <div className="px-4 py-10 sm:px-6">
          <PageSkeleton />
        </div>
      ) : (
        <SopDocument ref={docRef} html={html} suggesting={suggesting} marked={marked} onPick={onPick} onReady={onReady} />
      )}

      {/* Spacer so the floating bar never covers the footer. */}
      <div className="h-20 bg-[#fff]" aria-hidden />

      <SuggestBar
        suggesting={suggesting}
        openCount={canSuggest ? openCount : 0}
        canSeeList={canSuggest}
        onStart={startSuggesting}
        onStop={stopSuggesting}
        onOpenList={() => setPanelOpen(true)}
      />

      {signInPrompt && (
        <SignInPrompt returnTo={returnTo} onClose={() => setSignInPrompt(false)} />
      )}

      {pick && (
        <Composer
          key={`${pick.anchorId}:${pick.quote}`}
          sop={sop}
          pick={pick}
          onClose={() => {
            setPick(null);
            window.getSelection()?.removeAllRanges();
          }}
        />
      )}

      <SuggestionsPanel
        open={panelOpen}
        onOpenChange={setPanelOpen}
        sop={sop}
        suggestions={suggestions}
        canReview={Boolean(access?.canReview)}
        onJump={(anchorId) => {
          setPanelOpen(false);
          window.setTimeout(() => {
            if (!docRef.current?.flash(anchorId)) toast.message("That spot isn't on this version of the page.");
          }, 250);
        }}
      />
    </div>
  );
}

function SuggestBar({
  suggesting,
  openCount,
  canSeeList,
  onStart,
  onStop,
  onOpenList,
}: {
  suggesting: boolean;
  openCount: number;
  canSeeList: boolean;
  onStart: () => void;
  onStop: () => void;
  onOpenList: () => void;
}) {
  if (!suggesting) {
    return (
      <div className="fixed right-4 bottom-4 z-30 flex items-center gap-2 sm:right-6 sm:bottom-6">
        {canSeeList && openCount > 0 && (
          <Button variant="outline" size="sm" className="h-10 rounded-full bg-card shadow-pop" onClick={onOpenList}>
            <MessageSquareText />
            {openCount}
            <span className="sr-only"> suggestions on this SOP</span>
          </Button>
        )}
        <Button size="sm" className="h-10 rounded-full px-4 shadow-pop" onClick={onStart}>
          <Pencil />
          Suggest an edit
        </Button>
      </div>
    );
  }

  return (
    <div
      role="region"
      aria-label="Suggest mode"
      className="fixed inset-x-3 bottom-3 z-30 mx-auto flex max-w-2xl items-center gap-2 rounded-xl border bg-card p-2 pl-4 shadow-pop sm:bottom-6"
    >
      <span className="relative flex size-2.5 shrink-0" aria-hidden>
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-cta opacity-60 motion-reduce:hidden" />
        <span className="relative inline-flex size-2.5 rounded-full bg-cta" />
      </span>
      <p className="min-w-0 flex-1 text-sm leading-5">
        <span className="font-semibold">Suggest mode.</span>{" "}
        <span className="text-muted-foreground">
          <span className="hidden sm:inline">Select the words you want changed, or click a block.</span>
          <span className="sm:hidden">Tap what you want changed.</span>
        </span>
      </p>
      <Button variant="ghost" size="sm" onClick={onOpenList}>
        <MessageSquareText />
        <span className="hidden sm:inline">Suggestions</span>
        {openCount > 0 && <Badge className="pointer-events-none">{openCount}</Badge>}
      </Button>
      <Button size="sm" onClick={onStop}>
        <Check />
        Done
      </Button>
    </div>
  );
}

function SignInPrompt({ returnTo, onClose }: { returnTo: string; onClose: () => void }) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    panel.current?.focus();
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-3 sm:items-center" onClick={onClose}>
      <div
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sop-signin-title"
        className="w-full max-w-sm rounded-xl border bg-card p-5 shadow-pop outline-none"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-1 flex items-start justify-between gap-3">
          <h2 id="sop-signin-title" className="text-lg">
            Sign in to suggest an edit
          </h2>
          <Button variant="ghost" size="icon" className="-mt-2 -mr-2 size-8" onClick={onClose} aria-label="Close">
            <X />
          </Button>
        </div>
        <p className="mb-5 text-sm leading-6 text-muted-foreground">
          Anyone can read the SOP book. Suggestions come from Robot Dolphins team members, so sign in with your Dolphin
          Apps account first. You'll come straight back here.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Not now
          </Button>
          <Button asChild>
            <Link to={`/auth?returnTo=${encodeURIComponent(returnTo)}`}>
              <LogIn />
              Sign in
            </Link>
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Composer({ sop, pick, onClose }: { sop: SopEntry; pick: SopPick; onClose: () => void }) {
  const submit = useMutation(api.sopSuggestions.submit);
  const [kind, setKind] = useState<SuggestionKind>("fix");
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const wide = typeof window !== "undefined" && window.matchMedia("(min-width: 640px)").matches;
  const width = 380;
  const left = Math.min(Math.max(12, pick.rect.left), window.scrollX + document.documentElement.clientWidth - width - 12);
  const top = pick.rect.bottom + 10;

  useEffect(() => {
    textRef.current?.focus({ preventScroll: true });
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function send() {
    if (comment.trim().length < 3) {
      textRef.current?.focus();
      toast.error("Write what should change.");
      return;
    }
    setSending(true);
    try {
      await submit({
        sopId: sop.id,
        sopTitle: sop.title,
        sopVersion: sop.version,
        anchorId: pick.anchorId,
        anchorLabel: pick.anchorLabel,
        quote: pick.quote,
        kind,
        comment,
      });
      toast.success("Suggestion sent", { description: "A mentor will review it. Keep going, or press Done." });
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message.replace(/^.*Uncaught Error: /, "").split("\n")[0] : "That didn't send.");
      setSending(false);
    }
  }

  return createPortal(
    <div
      role="dialog"
      aria-label="Suggest a change"
      className={cn(
        "z-50 rounded-xl border bg-card p-4 text-card-foreground shadow-pop",
        wide ? "absolute" : "fixed inset-x-3 bottom-3 max-h-[calc(100dvh-5rem)] overflow-y-auto",
      )}
      style={wide ? { top, left, width } : undefined}
      onPointerUp={(event) => event.stopPropagation()}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-heading text-[15px] font-semibold">Suggest a change</p>
          <p className="truncate text-xs text-muted-foreground" title={pick.anchorLabel}>
            {pick.anchorLabel}
          </p>
        </div>
        <Button variant="ghost" size="icon" className="-mt-1 -mr-2 size-8" onClick={onClose} aria-label="Cancel">
          <X />
        </Button>
      </div>
      <blockquote className="mb-3 line-clamp-4 border-l-[3px] border-warning/70 bg-warning/8 py-1.5 pr-2 pl-3 text-sm leading-5 text-foreground/85">
        {pick.quote}
      </blockquote>
      <div role="radiogroup" aria-label="Kind of change" className="mb-2 flex flex-wrap gap-1.5">
        {suggestionKinds.map((item) => (
          <button
            key={item.value}
            type="button"
            role="radio"
            aria-checked={kind === item.value}
            title={item.hint}
            onClick={() => setKind(item.value)}
            className={cn(
              "h-8 rounded-full border px-3 text-[13px] font-medium outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/45",
              kind === item.value
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input bg-card text-foreground hover:border-primary/40",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
      <label className="sr-only" htmlFor="sop-suggest-text">
        What should change?
      </label>
      <Textarea
        id="sop-suggest-text"
        ref={textRef}
        value={comment}
        maxLength={2000}
        onChange={(event) => setComment(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) void send();
        }}
        placeholder={
          kind === "question"
            ? "What are you unsure about?"
            : kind === "add"
              ? "What's missing? Write it the way it should read."
              : kind === "remove"
                ? "Why should this go?"
                : "Write the new wording, or what's wrong."
        }
        className="min-h-24"
      />
      <p className="mt-2 text-xs text-muted-foreground">
        No passwords, phone numbers or addresses: SOP pages are public.
      </p>
      <div className="mt-3 flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button size="sm" onClick={() => void send()} aria-busy={sending} disabled={sending}>
          <Send />
          {sending ? "Sending…" : "Send suggestion"}
        </Button>
      </div>
    </div>,
    document.body,
  );
}

type SuggestionRow = FunctionReturnType<typeof api.sopSuggestions.listForSop>[number];

function SuggestionsPanel({
  open,
  onOpenChange,
  sop,
  suggestions,
  canReview,
  onJump,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sop: SopEntry;
  suggestions: SuggestionRow[] | undefined;
  canReview: boolean;
  onJump: (anchorId: string) => void;
}) {
  const withdraw = useMutation(api.sopSuggestions.withdraw);

  async function takeBack(id: Id<"sopSuggestions">) {
    try {
      await withdraw({ suggestionId: id });
      toast.success("Suggestion withdrawn");
    } catch (error) {
      toast.error(error instanceof Error ? error.message.split("\n")[0] : "That didn't work.");
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto sm:max-w-md">
        <SheetHeader className="border-b">
          <SheetTitle>Suggestions on {sop.shortId}</SheetTitle>
          <SheetDescription>
            Open and accepted suggestions waiting for the next rebuild. Click one to see where it points.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-3 p-4">
          {suggestions === undefined ? (
            <PageSkeleton />
          ) : suggestions.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No suggestions yet. Be the first.</p>
          ) : (
            suggestions.map((row) => (
              <article key={row._id} className="rounded-lg border bg-card">
                <button
                  type="button"
                  onClick={() => onJump(row.anchorId)}
                  className="block w-full rounded-t-lg p-3 text-left outline-none hover:bg-accent/60 focus-visible:ring-[3px] focus-visible:ring-ring/45"
                >
                  <span className="mb-1.5 flex flex-wrap items-center gap-1.5">
                    <Badge variant={row.status === "accepted" ? "success" : "warning"}>
                      {row.status === "accepted" ? "Accepted" : "Open"}
                    </Badge>
                    <Badge variant="secondary">{kindLabel(row.kind)}</Badge>
                    <span className="truncate text-xs text-muted-foreground">{row.anchorLabel}</span>
                  </span>
                  <span className="mb-1.5 line-clamp-2 block border-l-2 border-warning/60 pl-2 text-xs text-muted-foreground">
                    {row.quote}
                  </span>
                  <span className="block text-sm leading-6 whitespace-pre-line">{row.comment}</span>
                </button>
                <footer className="flex items-center justify-between gap-2 border-t px-3 py-2 text-xs text-muted-foreground">
                  <span>
                    {row.mine ? "You" : row.authorName} · {timeAgo(row.createdAt)}
                  </span>
                  {row.mine && row.status === "open" && (
                    <button
                      type="button"
                      className="font-medium text-destructive hover:underline"
                      onClick={() => void takeBack(row._id)}
                    >
                      Withdraw
                    </button>
                  )}
                </footer>
              </article>
            ))
          )}
          {canReview && (
            <Button asChild variant="outline" className="w-full">
              <Link to="/SOP/suggestions">Open the suggestions log</Link>
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
