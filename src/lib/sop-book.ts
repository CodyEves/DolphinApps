import { sopCatalog, sopDepartments, type SopDepartment, type SopEntry } from "@/sop-content/catalog";

export { sopBuiltAt, sopCatalog, sopDepartments, sopStyles } from "@/sop-content/catalog";
export type { SopDepartment, SopEntry } from "@/sop-content/catalog";

/** Each SOP page body is its own chunk, so the catalog loads without all 54 pages. */
const pageLoaders = import.meta.glob<string>("../sop-content/pages/*.html", {
  query: "?raw",
  import: "default",
});

export const SOP_HOME = "/SOP";

export function sopHref(sop: Pick<SopEntry, "deptSlug" | "shortId">) {
  return `${SOP_HOME}/${sop.deptSlug}/${sop.shortId}`;
}

export function deptHref(dept: Pick<SopDepartment, "slug">) {
  return `${SOP_HOME}/${dept.slug}`;
}

export function findDepartment(slug: string | undefined) {
  if (!slug) return undefined;
  const wanted = slug.toLowerCase();

  return sopDepartments.find((dept) => dept.slug === wanted);
}

/** Accepts MACH-001, mach-001 or RDOS-SOP-MACH-001. */
export function findSop(id: string | undefined) {
  if (!id) return undefined;
  const wanted = id.toUpperCase().replace(/^RDOS-SOP-/, "");

  return sopCatalog.find((sop) => sop.shortId === wanted);
}

export function sopsInDepartment(slug: string) {
  return sopCatalog.filter((sop) => sop.deptSlug === slug);
}

export async function loadSopPage(shortId: string) {
  const loader = pageLoaders[`../sop-content/pages/${shortId}.html`];

  if (!loader) {
    throw new Error(`No page for ${shortId}`);
  }

  return await loader();
}

export function searchSops(needle: string) {
  const terms = needle.trim().toLowerCase().split(/\s+/).filter(Boolean);

  if (terms.length === 0) return [];

  return sopCatalog.filter((sop) => {
    const haystack = [sop.id, sop.title, sop.summary, sop.dept, sop.style, ...sop.sections].join(" ").toLowerCase();

    return terms.every((term) => haystack.includes(term));
  });
}

export const suggestionKinds = [
  { value: "fix", label: "Fix wording", hint: "Something is wrong or unclear" },
  { value: "add", label: "Add", hint: "A missing step, warning or detail" },
  { value: "remove", label: "Remove", hint: "Out of date or not how we do it" },
  { value: "question", label: "Question", hint: "Not sure this is right" },
] as const;

export type SuggestionKind = (typeof suggestionKinds)[number]["value"];

export function kindLabel(kind: SuggestionKind) {
  return suggestionKinds.find((item) => item.value === kind)?.label ?? kind;
}
