# UI Overhaul Task List

A running backlog of bite-sized UI fixes, worked one at a time as you have spare usage.
This is not a full redesign yet — no visual identity/brand work here (see the note at the
bottom about robotdolphins.org). These are concrete, scoped fixes: bugs, confusing
layout, wasted space, inconsistent copy.

**How to use this file:** tell Claude "do the next one" or reference a task by name/number.
When a task is finished, Claude should check it off (`[x]`) and add a one-line note of what
changed, rather than deleting it — keeps a changelog. Feel free to reorder, delete, or add
items yourself at any time.

Scope so far: the Shop Attendance page (`src/pages/shop-attendance.tsx`) and its
admin/lead session + event creation flows, since that's the most-used page today.

---

## Open tasks

- [ ] **1. Duplicate/misleading "Display" nav item.** There are two different navigation
  bars stacked on `/shop`: the outer route nav (Overview / Display / Records / Review /
  Reports, from `ShopSectionNav`) and an inner tab bar (Display / Live / Schedule / Events /
  Check in/out). Both have an item literally called "Display" but they go to different
  places — the outer one opens the full kiosk view at `/shop/display`, the inner tab just
  shows the code inline on the Overview page. Rename one of them (e.g. inner tab → "Code")
  so they're not identical labels pointing at different things.

- [ ] **2. Two stacked pill-nav rows eat the whole screen on mobile.** On a phone, the
  outer route nav + inner tab nav together wrap to 3 lines of buttons before any real
  content appears (verified at 375px width). Shop Attendance is the page mentors/students
  use most on their phones. Worth collapsing to one navigation level, or turning the inner
  tabs into a dropdown/select on small screens.

- [ ] **3. Raw enum value leaking into the student list UI.** In the Records/Review/Reports
  student picker (`shop-attendance.tsx` ~line 1935), a student row shows both
  `studentGroup` ("5199 Student") AND the raw `primaryProgram` enum value ("frc_5199")
  side by side — e.g. "5199 Student · 2028 · frc_5199". The `frc_5199`/`frc_9271` value
  should never be shown to a user directly; drop it or map it to a friendly label, and
  it's redundant with `studentGroup` anyway.

- [ ] **4. Top header repeats "Shop Attendance" instead of the sub-page name.** On
  `/shop/records`, `/shop/review`, and `/shop/reports`, the small breadcrumb-style header
  at the top of the app shows "Shop Attendance" / "Shop Attendance" (both lines the same).
  Root cause: `shopNavItems` in `src/components/navigation.tsx` only lists `/shop` and
  `/shop/display`, so the header's `current?.label ?? appLabel` fallback (line ~237) can't
  find a match for those routes and falls back to the generic app label twice. Add entries
  for Records/Review/Reports (or otherwise fix the fallback) so it shows the actual
  sub-page name.

- [ ] **5. Admin/lead forms stack vertically until very wide screens.** The "Create event"
  form and event list use a two-column layout (`xl:grid-cols-[420px_1fr]`), which only
  kicks in at 1280px+. On a typical laptop (1024–1279px) or tablet, it's a single long
  scrolling column even though there's room for two. Drop the breakpoint to `lg:` (or
  check other similar grids on this page for the same issue).

- [ ] **6. "Start session" input has no persistent label.** The shop-session-title field
  only has a placeholder ("Optional session title"), no actual `<Label>` — the hint
  disappears the moment you start typing. Minor, but worth a pass to check other
  placeholder-only inputs on this page for the same gap.

- [ ] **7. "Add student without a code" search stays fully interactive with no active
  session.** On the Live tab, when there's no active shop session, the search input and
  "Sign in" button are still shown as if usable (the button is technically disabled once
  you pick someone, but there's no explanation why). Either disable the whole control or
  show inline text like "Start a shop session first."

- [ ] **8. "Sign out" button icon doesn't read as sign-out.** Both the shop live-roster
  sign-out button and the student's own sign-out button use `ArrowLeftRight`, which doesn't
  intuitively communicate "sign out." Consider a `LogOut`-style icon instead.

---

## Bigger, not-bite-sized items (parked for later)

- **Overall visual identity.** The app is currently a generic dark shadcn admin theme.
  The real team site (robotdolphins.org) is light-themed, navy blue (`#1e3a6d`-ish) on a
  light gray background, with a bold rounded sans-serif headline font. Eventually the app
  should feel like it belongs to the same team — but that's a full site pass, not a
  bite-sized task, and explicitly deferred per your instruction.
