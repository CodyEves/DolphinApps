import {
  ArrowRight,
  BookOpenCheck,
  Briefcase,
  ChevronRight,
  Cog,
  Compass,
  Hammer,
  HandHeart,
  HardHat,
  Megaphone,
  PenTool,
  Search,
  Trophy,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { createElement, useState, type ReactNode } from "react";
import { Link, Navigate, useParams } from "react-router";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  deptHref,
  findDepartment,
  findSop,
  searchSops,
  sopCatalog,
  sopDepartments,
  sopHref,
  sopsInDepartment,
  sopStyles,
  SOP_HOME,
  type SopEntry,
} from "@/lib/sop-book";
import { cn } from "@/lib/utils";

const deptIcons: Record<string, LucideIcon> = {
  "start-here": Compass,
  "shop-safety": HardHat,
  machines: Cog,
  design: PenTool,
  "electrical-software": Zap,
  "build-season": Hammer,
  competition: Trophy,
  "events-volunteering": HandHeart,
  business: Briefcase,
  "media-outreach": Megaphone,
  "people-program": Users,
};

function DeptIcon({ slug, className }: { slug: string; className?: string }) {
  return createElement(deptIcons[slug] ?? BookOpenCheck, { className, "aria-hidden": true });
}

export function Crumbs({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-5 flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
      {items.map((item, index) => (
        <span key={item.label} className="flex items-center gap-1">
          {index > 0 && <ChevronRight className="size-3.5 opacity-60" aria-hidden />}
          {item.href ? (
            <Link
              to={item.href}
              className="rounded-sm outline-none hover:text-foreground hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              {item.label}
            </Link>
          ) : (
            <span aria-current="page" className="font-medium text-foreground">
              {item.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}

function StatusBadges({ sop }: { sop: SopEntry }) {
  const approved = sop.status.toLowerCase() === "approved";

  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <Badge variant={approved ? "success" : "warning"}>{sop.status}</Badge>
      <Badge variant="secondary" title={sopStyles[sop.style]}>
        {sop.style}
      </Badge>
      {sop.blanks > 0 && (
        <Badge variant="outline" title="Items on this page that still need team facts">
          {sop.blanks} to fill
        </Badge>
      )}
    </span>
  );
}

function SopCard({ sop, showDept = false }: { sop: SopEntry; showDept?: boolean }) {
  return (
    <Link
      to={sopHref(sop)}
      className="group flex h-full flex-col rounded-lg border border-t-4 border-t-primary bg-card shadow-card outline-none transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:shadow-pop focus-visible:ring-[3px] focus-visible:ring-ring/45"
    >
      <span className="flex flex-1 flex-col gap-1.5 p-4 sm:p-5">
        <span className="font-mono text-xs tracking-wide text-muted-foreground">
          {sop.id}
          {showDept && <span className="font-sans"> · {sop.dept}</span>}
        </span>
        <span className="font-heading text-[17px] leading-snug font-semibold text-primary group-hover:underline group-hover:underline-offset-4 dark:text-foreground">
          {sop.title}
        </span>
        <span className="line-clamp-3 text-sm leading-6 text-muted-foreground">{sop.summary}</span>
      </span>
      <span className="border-t px-4 py-3 sm:px-5">
        <StatusBadges sop={sop} />
      </span>
    </Link>
  );
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="px-4 py-3 sm:px-5">
      <dt className="text-xs text-white/70">{label}</dt>
      <dd className="font-heading text-xl font-semibold text-white">{value}</dd>
    </div>
  );
}

/** Full-bleed brand band at the top of the catalog, matching the suite home page. */
function SopHero({ children }: { children: ReactNode }) {
  return (
    <section className="starfield -mx-4 -mt-6 bg-app-bar text-white sm:-mx-6 sm:-mt-10">
      <div className="mx-auto max-w-[75rem] px-4 pt-8 pb-10 sm:px-6 sm:pt-12 sm:pb-14">{children}</div>
    </section>
  );
}

export function SopCatalogPage() {
  const [query, setQuery] = useState("");
  const results = searchSops(query);
  const searching = query.trim().length > 0;
  const approved = sopCatalog.filter((sop) => sop.status.toLowerCase() === "approved").length;
  const blanks = sopCatalog.reduce((sum, sop) => sum + sop.blanks, 0);
  const start = findSop("ORG-000");

  return (
    <div>
      <SopHero>
        <p className="mb-3 text-xs font-semibold tracking-[0.3em] text-white/70 uppercase">
          Operations manual · Team 5199 · Team 9271
        </p>
        <h1 className="max-w-[20ch] text-[2rem] leading-[1.1] font-semibold text-white sm:text-[2.75rem]">
          How the Robot Dolphins run
        </h1>
        <p className="mt-3 max-w-[62ch] text-[15px] leading-7 text-white/80 sm:text-base">
          Every process our team runs, written down so any member, or any team, can run it the same way. Anyone can
          read these. Team members can sign in to suggest an edit.
        </p>
        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <label className="block w-full max-w-xl">
            <span className="sr-only">Search the SOP book</span>
            <span className="relative block">
              <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search: battery, scouting, sponsor, CNC…"
                className="h-12 rounded-full border-transparent bg-card pl-10 text-base text-foreground shadow-pop"
                autoComplete="off"
              />
            </span>
          </label>
          <dl className="flex shrink-0 divide-x divide-white/20 overflow-hidden rounded-xl border border-white/20 bg-white/5">
            <Stat label="SOPs" value={sopCatalog.length} />
            <Stat label="Sections" value={sopDepartments.length} />
            <Stat label="Approved" value={approved} />
            <Stat label="Blanks to fill" value={blanks} />
          </dl>
        </div>
      </SopHero>

      <div className="mx-auto max-w-[75rem] pt-8 sm:pt-10">
        {searching ? (
          <section aria-live="polite">
            <h2 className="mb-4 text-lg">
              {results.length === 0
                ? "No SOPs match that search"
                : `${results.length} SOP${results.length === 1 ? "" : "s"} match`}
            </h2>
            {results.length === 0 ? (
              <p className="text-sm text-muted-foreground">Try a shorter word, or browse the sections below.</p>
            ) : (
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {results.map((sop) => (
                  <li key={sop.id}>
                    <SopCard sop={sop} showDept />
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : (
          <>
            {start && (
              <Link
                to={sopHref(start)}
                className="mb-8 flex items-center gap-4 rounded-lg border bg-card p-4 shadow-card outline-none transition-colors hover:border-primary/40 focus-visible:ring-[3px] focus-visible:ring-ring/45 sm:p-5"
              >
                <span className="grid size-11 shrink-0 place-items-center rounded-[11px] bg-cta text-cta-foreground">
                  <Compass className="size-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-heading text-[15px] font-semibold">New here? Start with {start.shortId}</span>
                  <span className="block text-sm text-muted-foreground">
                    How this manual works, and how to suggest a change.
                  </span>
                </span>
                <ArrowRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
              </Link>
            )}
            <h2 className="mb-4 text-xl">Sections</h2>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {sopDepartments.map((dept) => {
                const items = sopsInDepartment(dept.slug);

                return (
                  <li key={dept.slug}>
                    <Link
                      to={deptHref(dept)}
                      className="group flex h-full gap-4 rounded-lg border bg-card p-4 shadow-card outline-none transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-pop focus-visible:ring-[3px] focus-visible:ring-ring/45 sm:p-5"
                    >
                      <span className="grid size-11 shrink-0 place-items-center rounded-[11px] bg-primary text-primary-foreground shadow-[inset_0_-2px_0_rgb(0_0_0/0.18)]">
                        <DeptIcon slug={dept.slug} className="size-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="font-heading text-[16px] leading-5 font-semibold">{dept.name}</span>
                          <span className="font-mono text-xs text-muted-foreground">{String(dept.number).padStart(2, "0")}</span>
                        </span>
                        <span className="mt-1 block text-sm leading-5 text-muted-foreground">{dept.blurb}</span>
                        <span className="mt-3 block text-xs font-medium text-primary dark:text-foreground">
                          {items.length} SOP{items.length === 1 ? "" : "s"}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
            <section className="mt-12 rounded-lg border bg-card p-5 sm:p-6">
              <h2 className="mb-1 text-lg">SOP styles</h2>
              <p className="mb-4 text-sm text-muted-foreground">Each SOP uses the style that fits the work.</p>
              <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {Object.entries(sopStyles).map(([style, description]) => (
                  <div key={style}>
                    <dt className="font-heading text-sm font-semibold">{style}</dt>
                    <dd className="text-sm text-muted-foreground">{description}</dd>
                  </div>
                ))}
              </dl>
            </section>
            <p className="mt-6 text-center text-xs text-muted-foreground">
              Other teams are welcome to copy and adapt any SOP in this book.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export function SopDepartmentPage() {
  const { dept: deptParam } = useParams();
  const dept = findDepartment(deptParam);
  const sop = dept ? undefined : findSop(deptParam);

  if (!dept) {
    // /SOP/MACH-001 still works: send it to the SOP's real address.
    return sop ? <Navigate to={sopHref(sop)} replace /> : <SopNotFound />;
  }

  const items = sopsInDepartment(dept.slug);

  return (
    <div className="mx-auto max-w-[75rem]">
      <Crumbs items={[{ label: "SOP Book", href: SOP_HOME }, { label: dept.name }]} />
      <header className="mb-8 flex items-start gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-[12px] bg-primary text-primary-foreground shadow-[inset_0_-2px_0_rgb(0_0_0/0.18)]">
          <DeptIcon slug={dept.slug} className="size-6" />
        </span>
        <div className="min-w-0 space-y-1">
          <h1 className="text-[1.625rem] leading-tight font-semibold sm:text-[1.875rem]">{dept.name}</h1>
          <p className="max-w-[65ch] text-[15px] leading-6 text-muted-foreground">
            {dept.blurb}. {items.length} SOP{items.length === 1 ? "" : "s"}.
          </p>
        </div>
      </header>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <li key={item.id}>
            <SopCard sop={item} />
          </li>
        ))}
      </ul>
      <DeptPager current={dept.slug} />
    </div>
  );
}

function DeptPager({ current }: { current: string }) {
  const index = sopDepartments.findIndex((dept) => dept.slug === current);
  const prev = sopDepartments[index - 1];
  const next = sopDepartments[index + 1];
  const linkClass =
    "flex min-w-0 flex-1 flex-col gap-0.5 rounded-lg border bg-card p-4 outline-none transition-colors hover:border-primary/40 focus-visible:ring-[3px] focus-visible:ring-ring/45";

  return (
    <nav aria-label="Other sections" className="mt-10 flex gap-3">
      {prev ? (
        <Link to={deptHref(prev)} className={linkClass}>
          <span className="text-xs text-muted-foreground">Previous section</span>
          <span className="truncate font-heading text-sm font-semibold">{prev.name}</span>
        </Link>
      ) : (
        <span className="flex-1" />
      )}
      {next ? (
        <Link to={deptHref(next)} className={cn(linkClass, "items-end text-right")}>
          <span className="text-xs text-muted-foreground">Next section</span>
          <span className="truncate font-heading text-sm font-semibold">{next.name}</span>
        </Link>
      ) : (
        <span className="flex-1" />
      )}
    </nav>
  );
}

export function SopNotFound() {
  return (
    <div className="mx-auto max-w-xl py-10 text-center">
      <h1 className="mb-2 text-2xl font-semibold">That SOP isn't in the book</h1>
      <p className="mb-6 text-muted-foreground">It may have moved to another section or been renumbered.</p>
      <Link to={SOP_HOME} className="font-semibold text-primary underline-offset-4 hover:underline dark:text-foreground">
        Browse the SOP book
      </Link>
    </div>
  );
}
