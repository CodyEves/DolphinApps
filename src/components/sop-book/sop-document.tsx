import { forwardRef, memo, useEffect, useImperativeHandle, useLayoutEffect, useRef } from "react";
import { useNavigate } from "react-router";

import { cn } from "@/lib/utils";
import "@/sop-content/sop-doc.css";

/** What a suggestion is pinned to: one block of the generated page. */
export type SopPick = {
  anchorId: string;
  anchorLabel: string;
  quote: string;
  /** Where to put the comment box, in page coordinates. */
  rect: { top: number; left: number; bottom: number; width: number };
};

export type SopDocumentHandle = {
  /** Scroll to a block and flash it. Returns false if the block isn't on this version of the page. */
  flash: (anchorId: string) => boolean;
  labelFor: (anchorId: string) => string | undefined;
};

/**
 * Blocks a suggestion can point at. A match inside another match is skipped,
 * so a paragraph inside a warning box belongs to the box.
 */
const BLOCK_SELECTOR = "h1,h2,h3,h4,p,li,tr,summary,.hz,.pk,.st,.ghead,.ctl > div";
const MAX_QUOTE = 600;

function clean(text: string | null | undefined) {
  return (text ?? "").replace(/\s+/g, " ").trim();
}

/** A drag that starts or ends mid-word quotes the whole word. */
function wholeWords(quote: string, blockText: string) {
  const start = blockText.indexOf(quote);
  if (!quote || start < 0) return quote;
  let from = start;
  let to = start + quote.length;
  while (from > 0 && /[\p{L}\p{N}'’-]/u.test(blockText[from - 1])) from -= 1;
  while (to < blockText.length && /[\p{L}\p{N}'’-]/u.test(blockText[to])) to += 1;

  return blockText.slice(from, to);
}

function clip(text: string, max = MAX_QUOTE) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function sectionTitle(section: Element | null) {
  if (!section) return "Page";
  if (section.id === "summary") return "Summary";
  if (section.id === "at-a-glance") return "At a glance";
  if (section.id === "revision-history") return "Revision history";
  const heading = section.querySelector("h2");
  if (!heading) return clean(section.id.replace(/-/g, " "));
  const clone = heading.cloneNode(true) as HTMLElement;
  clone.querySelectorAll(".n, .tag").forEach((node) => node.remove());

  return clean(clone.textContent);
}

function positionLabel(el: Element) {
  const gate = el.closest(".gate");
  const gateName = clean(gate?.querySelector(".ghead small")?.textContent);
  const inGate = (label: string) => (gateName ? `${gateName} › ${label}` : label);

  if (el.matches(".ghead")) return `${gateName || "Gate"} heading`;
  if (el.matches("h2")) return "Section heading";
  if (el.matches("h1")) return "Title";
  if (el.matches(".st")) return `Station ${[...(el.parentElement?.children ?? [])].indexOf(el) + 1}`;
  if (el.matches(".hz")) return inGate(`${clean(el.firstElementChild?.textContent) || "Callout"} box`);
  if (el.matches(".ctl > div")) return clean(el.querySelector("dt")?.textContent) || "Page details";

  if (el.matches("li")) {
    const list = el.parentElement;
    const index = [...(list?.children ?? [])].indexOf(el);

    if (list?.matches("ol.steps")) {
      const start = Number(list.getAttribute("start") ?? "1");
      return inGate(`Step ${start + index}`);
    }

    if (el.closest(".check")) return inGate(`Checklist item ${index + 1}`);
    const card = clean(el.closest(".fact")?.querySelector("h3")?.textContent);
    if (card) return `${card} card, item ${index + 1}`;

    return inGate(`List item ${index + 1}`);
  }

  if (el.matches("tr")) {
    const body = el.parentElement;
    if (body?.tagName === "THEAD") return "Table header";
    return `Table row ${[...(body?.children ?? [])].indexOf(el) + 1}`;
  }

  const phase = el.matches(".phase") ? "Phase label" : null;
  if (phase) return phase;
  if (el.matches("h3")) return inGate("Heading");

  return inGate("Paragraph");
}

/** Give every block a stable id (section:position) and a human label. */
function annotate(root: HTMLElement) {
  const labels = new Map<string, string>();
  const counters = new Map<string, number>();

  for (const el of root.querySelectorAll(BLOCK_SELECTOR)) {
    if (el.closest("nav.toc, .meter")) continue;
    if (el.parentElement?.closest(BLOCK_SELECTOR) && root.contains(el.parentElement.closest(BLOCK_SELECTOR))) continue;

    const section = el.closest("section[id], footer");
    const key = section?.tagName === "FOOTER" ? "footer" : (section?.id ?? "page");
    const index = counters.get(key) ?? 0;
    counters.set(key, index + 1);

    const id = `${key}:${index}`;
    const title = key === "footer" ? "Page footer" : sectionTitle(section);
    const label = el.matches("h2") ? `${title} (heading)` : `${title} › ${positionLabel(el)}`;

    (el as HTMLElement).dataset.a = id;
    labels.set(id, label);
  }

  return labels;
}

function updateMeter(box: Element) {
  const inputs = [...box.querySelectorAll<HTMLInputElement>("input[type=checkbox]")];
  const done = inputs.filter((input) => input.checked).length;
  const all = inputs.length > 0 && done === inputs.length;
  const count = box.querySelector(".cnt");
  const fill = box.querySelector<HTMLElement>(".bar i");
  const msg = box.querySelector(".msg");

  if (count) count.textContent = String(done);
  if (fill) fill.style.width = `${inputs.length ? (done / inputs.length) * 100 : 0}%`;
  box.querySelector(".meter")?.classList.toggle("done", all);
  if (msg) msg.textContent = all ? "All clear." : done ? `${inputs.length - done} left.` : "Work down the list.";
}

/** The page body never re-renders after it's set, so checkbox state and anchors survive. */
const HtmlBody = memo(function HtmlBody({ html }: { html: string }) {
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
});

type Props = {
  html: string;
  suggesting: boolean;
  /** Blocks that already have a suggestion. */
  marked: string[];
  onPick: (pick: SopPick) => void;
  onReady?: () => void;
};

export const SopDocument = forwardRef<SopDocumentHandle, Props>(function SopDocument(
  { html, suggesting, marked, onPick, onReady },
  ref,
) {
  const rootRef = useRef<HTMLDivElement>(null);
  const labelsRef = useRef(new Map<string, string>());
  const navigate = useNavigate();
  const suggestingRef = useRef(suggesting);
  const onPickRef = useRef(onPick);
  suggestingRef.current = suggesting;
  onPickRef.current = onPick;

  useImperativeHandle(ref, () => ({
    flash(anchorId) {
      const el = rootRef.current?.querySelector<HTMLElement>(`[data-a="${CSS.escape(anchorId)}"]`);
      if (!el) return false;
      el.closest("details")?.setAttribute("open", "");
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.remove("sugg-flash");
      void el.offsetWidth;
      el.classList.add("sugg-flash");
      window.setTimeout(() => el.classList.remove("sugg-flash"), 1700);
      return true;
    },
    labelFor(anchorId) {
      return labelsRef.current.get(anchorId);
    },
  }));

  // Anchors and checklist meters, once per page body.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    labelsRef.current = annotate(root);
    root.querySelectorAll(".check").forEach(updateMeter);
    onReady?.();
  }, [html, onReady]);

  // Keep the section menu and checklist meters below the app's sticky header.
  useEffect(() => {
    const root = rootRef.current;
    const header = document.querySelector<HTMLElement>("body header.sticky");
    if (!root || !header) return;
    const apply = () => root.style.setProperty("--sop-top", `${header.offsetHeight}px`);
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(header);

    return () => observer.disconnect();
  }, []);

  // Existing suggestions get a marker in suggest mode.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const wanted = new Set(marked);
    root.querySelectorAll<HTMLElement>("[data-sugg]").forEach((el) => {
      if (!wanted.has(el.dataset.a ?? "")) delete el.dataset.sugg;
    });
    for (const id of wanted) {
      const el = root.querySelector<HTMLElement>(`[data-a="${CSS.escape(id)}"]`);
      if (el) el.dataset.sugg = "";
    }
  }, [marked, html]);

  // Clicks: checklists, in-page links and SOP links normally; picking blocks in suggest mode.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    function pickFromSelection() {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || selection.rangeCount === 0) return false;
      const range = selection.getRangeAt(0);
      if (!root!.contains(range.commonAncestorContainer)) return false;
      const startNode = range.startContainer;
      const startEl = startNode instanceof Element ? startNode : startNode.parentElement;
      const block =
        startEl?.closest<HTMLElement>("[data-a]") ??
        (range.commonAncestorContainer instanceof Element
          ? range.commonAncestorContainer
          : range.commonAncestorContainer.parentElement
        )?.closest<HTMLElement>("[data-a]");
      const quote = wholeWords(clean(selection.toString()), clean(block?.textContent));
      if (!block || !quote) return false;
      const box = range.getBoundingClientRect();
      onPickRef.current({
        anchorId: block.dataset.a!,
        anchorLabel: labelsRef.current.get(block.dataset.a!) ?? "Page",
        quote: clip(quote),
        rect: { top: box.top + window.scrollY, bottom: box.bottom + window.scrollY, left: box.left + window.scrollX, width: box.width },
      });
      return true;
    }

    function onPointerUp() {
      if (!suggestingRef.current) return;
      window.setTimeout(pickFromSelection, 0);
    }

    function onClick(event: MouseEvent) {
      const target = event.target as Element;

      if (suggestingRef.current) {
        event.preventDefault();
        const selection = window.getSelection();
        if (selection && !selection.isCollapsed) return;
        const block = target.closest<HTMLElement>("[data-a]");
        if (!block || !root!.contains(block)) return;
        const box = block.getBoundingClientRect();
        onPickRef.current({
          anchorId: block.dataset.a!,
          anchorLabel: labelsRef.current.get(block.dataset.a!) ?? "Page",
          quote: clip(clean(block.textContent)),
          rect: { top: box.top + window.scrollY, bottom: box.bottom + window.scrollY, left: box.left + window.scrollX, width: box.width },
        });
        return;
      }

      const reset = target.closest(".check .reset");
      if (reset) {
        const box = reset.closest(".check")!;
        box.querySelectorAll<HTMLInputElement>("input[type=checkbox]").forEach((input) => (input.checked = false));
        updateMeter(box);
        return;
      }

      const link = target.closest<HTMLAnchorElement>("a[href]");
      if (!link || event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
      const href = link.getAttribute("href") ?? "";

      if (href.startsWith("#")) {
        event.preventDefault();
        const el = root!.querySelector(`[id="${CSS.escape(href.slice(1))}"]`);
        el?.scrollIntoView({ behavior: "smooth", block: "start" });
        window.history.replaceState(window.history.state, "", href);
        return;
      }

      if (href.startsWith("/")) {
        event.preventDefault();
        navigate(href);
        return;
      }

      if (/^https?:/.test(href)) {
        link.target = "_blank";
        link.rel = "noopener noreferrer";
      }
    }

    function onChange(event: Event) {
      const box = (event.target as Element).closest(".check");
      if (box) updateMeter(box);
    }

    root.addEventListener("click", onClick);
    root.addEventListener("change", onChange);
    root.addEventListener("pointerup", onPointerUp);
    root.addEventListener("keyup", onPointerUp);

    return () => {
      root.removeEventListener("click", onClick);
      root.removeEventListener("change", onChange);
      root.removeEventListener("pointerup", onPointerUp);
      root.removeEventListener("keyup", onPointerUp);
    };
  }, [navigate]);

  return (
    <div ref={rootRef} className={cn("sop-doc", suggesting && "suggesting")}>
      <HtmlBody html={html} />
    </div>
  );
});
