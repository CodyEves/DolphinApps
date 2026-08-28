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

_None right now — everything below has shipped. Add new ones here as you spot them._

---

## Completed

- [x] **1. Duplicate/misleading "Display" nav item.** Renamed the inner tab (the one that
  just shows the code inline on Overview) from "Display" to "Code," so it no longer shares
  a label with the outer route nav's "Display" link that opens the full kiosk view.

- [x] **2. Two stacked pill-nav rows eat the whole screen on mobile.** Both nav bars
  (outer `ShopSectionNav` and the inner `TabsList`) now scroll horizontally as a single
  line below the `sm` breakpoint instead of wrapping to 2–3 lines, and wrap normally on
  larger screens same as before.

- [x] **3. Raw enum value leaking into the student list UI.** Dropped the raw
  `primaryProgram` ("frc_5199") display from the Records/Review/Reports student list and
  from the event-attendee badge fallback — both now rely on `studentGroup` alone, which
  already reads correctly ("5199 Student").

- [x] **4. Top header repeats "Shop Attendance" instead of the sub-page name.** Added
  Records/Review/Reports entries to `shopNavItems` in `src/components/navigation.tsx`
  (gated to managers, matching the in-page tabs). Fixes the duplicate header text and, as
  a bonus, they now also show up as real links in the sidebar/mobile nav sheet, consistent
  with how Training/Parts/Management already list their sub-pages.

- [x] **5. Admin/lead forms stack vertically until very wide screens.** Dropped four
  `xl:grid-cols-*` breakpoints to `lg:` (Events tab, Display tab, and the two Reports
  summary grids) so they go two-column starting at a normal laptop width. Left the
  6-column `EditableAttendanceRecord` row at `xl:` since going wider there would overflow
  before 1280px rather than help.

- [x] **6. "Start session" input has no persistent label.** Added a real `<Label>` above
  the shop-session-title field instead of relying on the placeholder alone.

- [x] **7. "Add student without a code" search stays fully interactive with no active
  session.** The search input is now disabled and shows "Start a shop session first."
  when there's no active session, instead of looking usable with no explanation.

- [x] **8. "Sign out" button icon doesn't read as sign-out.** Swapped `ArrowLeftRight` for
  `LogOut` on both sign-out buttons (shop live roster row, and the student's own sign-out
  button). Left `ArrowLeftRight` on the unrelated "Link to Slack account" button as-is.

---

## Bigger, not-bite-sized items (parked for later)

- **Overall visual identity.** The app is currently a generic dark shadcn admin theme.
  The real team site (robotdolphins.org) is light-themed, navy blue (`#1e3a6d`-ish) on a
  light gray background, with a bold rounded sans-serif headline font. Eventually the app
  should feel like it belongs to the same team — but that's a full site pass, not a
  bite-sized task, and explicitly deferred per your instruction.
