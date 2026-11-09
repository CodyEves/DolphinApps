import { useEffect, useState } from "react";

/** The round the 2026 availability form fed. */
export const INTERVIEW_ROUND_SLUG = "5199-2026";

/** The encrypted applicant review page (public/review). Same origin, so it shares localStorage. */
export const REVIEW_PAGE_PATH = "/review/5199-applicants-2026-27.html";
const REVIEW_KEY_STORAGE = "5199-review-key";
const MENTOR_KEY_STORAGE = "dolphin.interviews.key";
const EDITOR_NAME_STORAGE = "dolphin.interviews.name";

// ---------------------------------------------------------------------------
// localStorage (best effort: private windows can throw)
// ---------------------------------------------------------------------------

function readStored(key: string) {
  try {
    return window.localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function writeStored(key: string, value: string) {
  try {
    if (value) {
      window.localStorage.setItem(key, value);
    } else {
      window.localStorage.removeItem(key);
    }
  } catch {
    // Not remembered; the page still works for this visit.
  }
}

/**
 * The mentor key arrives in the link as #key=..., gets remembered on this
 * device, and is dropped from the address bar so it isn't screenshotted.
 */
export function useMentorKey() {
  const [key, setKeyState] = useState(() => {
    const fromHash = new URLSearchParams(window.location.hash.slice(1)).get("key")?.trim();

    if (fromHash) {
      writeStored(MENTOR_KEY_STORAGE, fromHash);
      return fromHash;
    }

    return readStored(MENTOR_KEY_STORAGE);
  });

  useEffect(() => {
    const dropKeyFromUrl = () =>
      window.history.replaceState(null, "", window.location.pathname + window.location.search);

    if (window.location.hash.includes("key=")) {
      dropKeyFromUrl();
    }

    // Pasting the mentor link into the address bar of an open tab only changes the hash.
    const onHashChange = () => {
      const fromHash = new URLSearchParams(window.location.hash.slice(1)).get("key")?.trim();

      if (fromHash) {
        writeStored(MENTOR_KEY_STORAGE, fromHash);
        setKeyState(fromHash);
        dropKeyFromUrl();
      }
    };

    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  return {
    key,
    setKey(next: string) {
      writeStored(MENTOR_KEY_STORAGE, next.trim());
      setKeyState(next.trim());
    },
  };
}

export function useEditorName() {
  const [name, setNameState] = useState(() => readStored(EDITOR_NAME_STORAGE));

  return {
    name,
    setName(next: string) {
      writeStored(EDITOR_NAME_STORAGE, next.trim());
      setNameState(next);
    },
  };
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

export function formatTime(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const suffix = hours >= 12 && hours < 24 ? "PM" : "AM";
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour12}:${String(mins).padStart(2, "0")} ${suffix}`;
}

export function formatTimeRange(start: number, duration: number) {
  return `${formatTime(start)} – ${formatTime(start + duration)}`;
}

function isoToDate(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}

export function formatDay(iso: string, style: "short" | "long" = "short") {
  return isoToDate(iso).toLocaleDateString("en-US", {
    weekday: style === "long" ? "long" : "short",
    month: style === "long" ? "long" : "short",
    day: "numeric",
  });
}

export function dayNumber(iso: string) {
  return isoToDate(iso).getDate();
}

export function todayIso() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function timeInputToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return Number.isFinite(hours) && Number.isFinite(minutes) ? hours * 60 + minutes : NaN;
}

export function minutesToTimeInput(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

/** Same rule the server uses when publishing. */
export function publicName(name: string, style: "full" | "initial") {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (style === "full" || parts.length < 2) {
    return parts.join(" ");
  }

  return `${parts[0]} ${parts[parts.length - 1].charAt(0).toUpperCase()}.`;
}

export function firstName(name: string) {
  return name.trim().split(/\s+/)[0] ?? name;
}

// ---------------------------------------------------------------------------
// Google Form CSV import
// ---------------------------------------------------------------------------

export type ImportRow = {
  name: string;
  email?: string;
  submittedAt?: number;
  dates: string[];
  note?: string;
};

/** RFC 4180-ish CSV: quoted fields, doubled quotes, newlines inside quotes. */
export function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[index + 1] === "\n") {
        index += 1;
      }
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((cells) => cells.some((cell) => cell.trim()));
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** "November 9th" -> "2026-11-09" when that month/day is one of the round's dates (any year). */
function parseFormDate(token: string, roundDates: string[]) {
  const match = token
    .trim()
    .toLowerCase()
    .match(/^([a-z]{3})[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?$/);

  if (!match) {
    return null;
  }

  const month = MONTHS.indexOf(match[1]) + 1;

  if (month === 0) {
    return null;
  }

  const suffix = `-${String(month).padStart(2, "0")}-${String(Number(match[2])).padStart(2, "0")}`;
  return roundDates.find((date) => date.endsWith(suffix)) ?? null;
}

function findColumn(header: string[], tests: RegExp[]) {
  for (const test of tests) {
    const index = header.findIndex((cell) => test.test(cell));

    if (index >= 0) {
      return index;
    }
  }

  return -1;
}

export function parseAvailabilityCsv(text: string, roundDates: string[]) {
  const [header, ...body] = parseCsv(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);

  if (!header) {
    throw new Error("That file is empty.");
  }

  const nameCol = findColumn(header, [/full name/i, /^name$/i, /name/i]);
  const emailCol = findColumn(header, [/email/i]);
  const timeCol = findColumn(header, [/timestamp/i]);
  const datesCol = findColumn(header, [/dates?/i, /availab/i]);

  if (nameCol < 0 || datesCol < 0) {
    throw new Error("Couldn't find the name and availability columns. Upload the form's response CSV.");
  }

  const rows: ImportRow[] = [];

  for (const cells of body) {
    // "Kegan puccini" -> "Kegan Puccini"; leaves "DeVoe" and "McCraw" alone.
    const name = cells[nameCol]
      ?.trim()
      .replace(/\s+/g, " ")
      .split(" ")
      .map((word) => (word === word.toLowerCase() ? word.charAt(0).toUpperCase() + word.slice(1) : word))
      .join(" ");

    if (!name) {
      continue;
    }

    const dates: string[] = [];
    const other: string[] = [];

    for (const token of (cells[datesCol] ?? "").split(",")) {
      const trimmed = token.trim();

      if (!trimmed) {
        continue;
      }

      const date = parseFormDate(trimmed, roundDates);

      if (date) {
        dates.push(date);
      } else {
        other.push(trimmed);
      }
    }

    const stamp = timeCol >= 0 ? Date.parse(cells[timeCol] ?? "") : NaN;

    rows.push({
      name,
      email: emailCol >= 0 ? cells[emailCol]?.trim() || undefined : undefined,
      submittedAt: Number.isFinite(stamp) ? stamp : undefined,
      dates,
      note: other.length ? other.join(", ") : undefined,
    });
  }

  return rows;
}

// ---------------------------------------------------------------------------
// Applicant review page link-up
// ---------------------------------------------------------------------------

export type ApplicantLink = { id: string; name: string; flags: number; critical: number };

function b64(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "===".slice((normalized.length + 3) % 4);
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}

function nameKey(name: string) {
  return name.toLowerCase().replace(/[^a-z ]/g, "").replace(/\s+/g, " ").trim();
}

/** True when two words differ by at most one insert, delete, or swap ("Gabory" / "Gaboury"). */
function withinOneEdit(a: string, b: string) {
  if (Math.abs(a.length - b.length) > 1 || a.length < 4 || b.length < 4) {
    return false;
  }

  let i = 0;
  let j = 0;
  let edits = 0;

  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i += 1;
      j += 1;
      continue;
    }

    edits += 1;

    if (edits > 1) {
      return false;
    }

    if (a.length > b.length) i += 1;
    else if (b.length > a.length) j += 1;
    else {
      i += 1;
      j += 1;
    }
  }

  return edits + (a.length - i) + (b.length - j) <= 1;
}

/** Pulls the access key out of a pasted review link (#KEY or #KEY~applicant). */
export function reviewKeyFromLink(link: string) {
  const hash = link.includes("#") ? link.slice(link.indexOf("#") + 1) : link;
  return hash.split("~")[0].trim();
}

export function saveReviewKey(key: string) {
  writeStored(REVIEW_KEY_STORAGE, key);
}

export function reviewLink(key: string, id: string) {
  return `${REVIEW_PAGE_PATH}#${key}~${id}`;
}

/**
 * Unlocks the applicant review page's encrypted roster with the key this
 * device already has (from opening the review link once), so each interview
 * candidate can link straight to their application.
 */
export function useApplicantIndex(refresh = 0) {
  const [state, setState] = useState<{
    status: "loading" | "no-key" | "ready" | "error";
    key?: string;
    match?: (name: string) => ApplicantLink | null;
  }>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    const key = readStored(REVIEW_KEY_STORAGE);

    (async () => {
      if (!key) {
        setState({ status: "no-key" });
        return;
      }

      if (!window.crypto?.subtle || typeof DecompressionStream === "undefined") {
        setState({ status: "error" });
        return;
      }

      try {
        const html = await (await fetch(REVIEW_PAGE_PATH, { cache: "no-cache" })).text();
        const json = html.match(/<script type="application\/json" id="enc">([\s\S]*?)<\/script>/)?.[1];

        if (!json) {
          throw new Error("No roster on the review page.");
        }

        const encrypted = JSON.parse(json) as { iv: string; ct: string };
        const cryptoKey = await crypto.subtle.importKey("raw", b64(key), "AES-GCM", false, ["decrypt"]);
        const gz = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64(encrypted.iv) }, cryptoKey, b64(encrypted.ct));
        const text = await new Response(
          new Blob([gz]).stream().pipeThrough(new DecompressionStream("gzip")),
        ).text();
        const payload = JSON.parse(text) as {
          apps?: Array<{ id: string; name: string; pref?: string; flags?: Array<{ level?: string }> }>;
        };
        const apps = (payload.apps ?? []).map((app) => ({
          id: app.id,
          name: app.name,
          pref: app.pref,
          flags: app.flags?.length ?? 0,
          critical: app.flags?.filter((flag) => flag.level === "crit").length ?? 0,
        }));
        const byFull = new Map(apps.map((app) => [nameKey(app.name), app]));

        const match = (name: string): ApplicantLink | null => {
          const wanted = nameKey(name);
          const exact = byFull.get(wanted);

          if (exact) {
            return exact;
          }

          const parts = wanted.split(" ");
          const first = parts[0];
          const last = parts[parts.length - 1];

          if (parts.length < 2) {
            return null;
          }

          const candidates = apps.filter((app) => {
            const appParts = nameKey(app.name).split(" ");
            const appFirst = appParts[0];
            const appLast = appParts[appParts.length - 1];
            const prefFirst = app.pref ? nameKey(app.pref).split(" ")[0] : "";
            const lastMatches =
              appLast === last ||
              appParts.includes(last) ||
              parts.includes(appLast) ||
              withinOneEdit(appLast, last);
            const firstMatches =
              appFirst === first ||
              prefFirst === first ||
              appFirst.startsWith(first) ||
              first.startsWith(appFirst);
            return lastMatches && firstMatches;
          });

          return candidates.length === 1 ? candidates[0] : null;
        };

        if (!cancelled) {
          setState({ status: "ready", key, match });
        }
      } catch {
        if (!cancelled) {
          setState({ status: "error" });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [refresh]);

  return state;
}
