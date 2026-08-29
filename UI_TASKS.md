# UI Overhaul Task List

A running backlog of UI fixes, worked one at a time as you have spare usage.

**How to use this file:** tell Claude "do the next one" or reference a task by name/number.
When a task is finished, Claude should check it off (`[x]`) and add a one-line note of what
changed, rather than deleting it — keeps a changelog. Feel free to reorder, delete, or add
items yourself at any time.

---

## Context: what this app is actually for

Dolphin Apps' Shop Attendance page tracks attendance for an FRC robotics team of **150+
students** running **50+ events a year**. This isn't incidental record-keeping — attendance
is a primary input to the team's application/interview process: how much a student
contributed (shop hours, events attended) weighs heavily in whether they stay on the team.
That means the reporting side needs to hold up at real scale, not just look good in a demo
with three students and one event.

There are two distinct audiences with different design goals, and they don't need to look
like each other:

- **Students** (check-in/out, event check-in, the code display on the shop TV): should feel
  like a clean, simple, pleasant consumer app. Low cognitive load, fast, a little delightful.
- **Admins/leads** (running sessions, creating events, correcting time clocks, running
  reports for the application process): should feel like professional management/ops
  software — dense, efficient, built for doing the same task 150 times in a row, not just
  once. Efficiency and information density beat visual flourish here.

The sections below are organized around that split. Items vary in size — some are one-file
tweaks, others are multi-step features — do them roughly in order within a section, but feel
free to jump around.

---

## A. Admin: attendance & hours reporting at scale

This is the highest-value area since it directly powers the application/interview decisions.

- [x] **A1/A2/A4. Turn the Reports "Student attendance" list into a real sortable/
  filterable table.** Implemented on the Reports tab's existing "Student attendance" list
  (not the `/shop/records` route — that one's a different, still-search-then-click per-
  student lookup and was left alone; the Reports tab already had all-students data with
  both shop hours *and* event counts via `attendanceOverviewReport`, which `/shop/records`
  doesn't have). It's now a real `<table>` (matching the admin-people.tsx data-table
  pattern) with click-to-sort columns (Student/Shop hours/Needs review/Events/Last
  attendance), a name/team/program/grad-year search box, a "below N hours" threshold
  filter for exactly the application-season use case, pagination (25/50/100 rows), and a
  second CSV export button ("Export this view") that respects the current filter/sort so
  you can filter to "under 10 hours" and export just that list. The original "Export
  overview CSV" button (unfiltered, full range) is unchanged.

- [x] **A3. Add a real per-student profile view that merges shop + events + status.** Added
  `listStudentEventAttendance` (new query, off the existing `eventAttendanceRecords.by_user`
  index) and an "Events attended" section on the per-student Reports page, alongside the
  existing shop-hours list — plus an event count in the stat row and its own CSV export.
  Reviewing one applicant's shop hours *and* events is now one page. Didn't pull in badges/
  training completion — that would mean reaching into `badges.ts`/`training.ts` data models,
  which felt like its own separate task rather than part of "attendance."

- [ ] **A5. Paginate or virtualize every unbounded list on this page.** Nothing on
  `/shop/records`, `/shop/review`, `/shop/reports`, or the Events tab paginates today —
  it's all `.collect()` on the backend and a full unbounded `.map()` render on the front end.
  At 150 students × a school year of sessions, and 50+ events/year, this will get slow on
  both ends. Backend queries (`attendanceOverviewReport`, `listHoursReport`,
  `listAttendanceRecords`) should take a date range or limit by default rather than scanning
  every row; the frontend lists need real pagination (the admin-people page already has a
  `pageIndex` pattern to copy from).

- [ ] **A6. Add a lightweight admin "health check" summary.** Something admins can see
  without running a report: how many students are below required hours right now, sessions
  this week, upcoming events, records needing review. A dashboard glance instead of having
  to go generate a report to find out something's wrong.

---

## B. Admin: session, schedule & event management at scale

- [ ] **B1. Add event duplication/templating.** At 50+ events/year, many are recurring
  (weekly practice, recurring outreach visits). Right now every event is built from a blank
  "Create event" form. A "Duplicate this event" action (copy title/location/description,
  prompt for a new date) would save real time over a season.

- [ ] **B2. Add filtering and pagination to the Events list.** The Events tab renders every
  event ever created in one scrolling list (title, date, status, attendee count). After a
  year or two this is a long scroll with no way to jump to "events from last month" or
  "active events only" beyond eyeballing it.

- [ ] **B3. Turn "Manual correction" / Review into a dense, table-style bulk editor.** Both
  are currently one-record-per-card with its own set of inputs, which is fine for a couple
  of corrections but slow if you're fixing time clocks for a whole session after a big event
  (e.g., the shop auto-closed and flagged 20 students overnight). A compact table with
  inline-editable in/out times and a "select multiple → approve" bulk action would match the
  "efficiency first" goal much better than the current card list.

- [ ] **B4. Reorganize the flat tab bar into task-oriented groups.** Right now Overview has
  five equally-weighted tabs (Code / Live / Schedule / Events / Check in/out) that mix
  "things I do every shop day" (Live roster, the code) with "things I set up occasionally"
  (Schedule) and "things for a different context entirely" (Events, which isn't about shop
  sessions at all). Worth grouping by job — e.g. "Today" (live session status + roster) vs.
  "Setup" (schedule, event creation) vs. "Reports" (already its own route) — so admins land
  on what they actually need to do that day instead of a flat list of nouns.

---

## C. Sign-out reminders & notifications

You specifically want students reminded to sign out, and to be notified yourself when they
don't. Both sides now get an after-the-fact notification when someone's auto-flagged (C1) —
what's still missing is a proactive heads-up *before* the shop closes (C2).

- [x] **C1. Notify the student, not just the admin, when they're auto-flagged.** Used the
  in-app notification bell (it already rendered for every signed-in user, it just always
  returned empty for non-reviewers). `listMine` now also returns a personal "You forgot to
  sign out" notification scoped to the viewer's own `needs_review` records, regardless of
  role — shown alongside the existing reviewer-facing notifications for anyone who has both
  (e.g. a mentor who forgot their own sign-out sees both). The "Open review queue" footer
  link is now gated to reviewers only, since students can't open that page. Verified live:
  an account with a real `needs_review` record now shows "You forgot to sign out" in its
  bell. Didn't add a proactive pre-close warning (that's C2, a different mechanism — a
  heads-up before the shop closes rather than a flag after).

- [ ] **C2. Add a proactive "shop closes soon" warning, not just an after-the-fact flag.**
  Today the only signal is retroactive: the session auto-closes at the 5:00 AM cutoff (or
  whenever you manually end it) and *then* flags who forgot. A heads-up before that — e.g.
  a Slack/notification ping N minutes before a scheduled close, or a banner on the display
  screen ("Shop closes in 15 minutes — make sure you've signed out") — would actually
  prevent the problem instead of just reporting it after the fact.

---

## D. Student-facing experience

- [ ] **D1. Show the student their own contribution stats on the check-in screen.** Right
  now signing in just shows "Signed in since 2:14 PM." Given hours/events directly feed the
  application process, showing something like "14.5 hrs this season · 6 events attended"
  right on the check-in screen turns a utility action into a small motivating moment — and
  it's a natural place to reinforce "this counts toward your application."

- [ ] **D2. Show event details before confirming an event code check-in.** Right now
  entering a code and hitting "Use code" is a bit of a leap of faith — a brief confirmation
  ("You're checking in to: FIRST Kickoff, Jan 4") before submitting would feel more
  trustworthy and catch typos (wrong code → wrong event) before they happen.

- [x] **D3. Give the student check-in/out screen its own, more polished visual treatment.**
  Checked the actual student view via the role-preview switcher (not just the admin view)
  and found real problems specific to this screen: a full-width single-item tab bar with
  nothing to switch to (dead chrome, now hidden whenever a role only has one shop tab —
  `hasMultipleShopTabs`), a code input styled identically to every other text field on the
  site (now a large, centered, wide-tracked monospace field closer to a 2FA/OTP entry, with
  Enter-to-submit), and a static "signed in since" timestamp (now a live-ticking duration —
  "2h 14m" — on a visually distinct highlighted card). Verified both the empty and
  already-signed-in-looking states live via role preview.

---

## E. Display / kiosk screen

- [ ] **E1. Surface a live headcount more prominently.** The display page already computes
  `currentCount`/`peakToday` and a weekly leaderboard (`shopDisplayStats`) and shows them —
  worth a pass on making the "X students here right now" number bigger/more prominent on the
  TV view itself, since that's the one screen 50+ kids look at simultaneously and a live
  count adds a bit of excitement/urgency.

---

## Completed

- [x] **9. (Bug, reported live) Admin's own flagged shop record was unfindable in
  Review.** Two separate causes: (a) `listAttendanceRecordPeople` — the "Find student"
  search backing Records/Review/Reports — only returned profiles with role `student` or
  `lead`, so any non-student role with a real attendance record (here, the admin account
  itself, from testing) was structurally unsearchable. Nothing restricts shop sign-in by
  role, so it now includes every active profile. (b) The Overview page's bulk "Review
  queue" tab (approve/void every flagged record at once + "Manual correction") existed in
  the JSX with no `TabsTrigger` pointing to it — completely unreachable by any click.
  Added a "Review queue" tab (deliberately not just "Review," to avoid repeating the
  duplicate-label bug from item 1) with a flagged-count badge. Also fixed two "Student"
  fallback labels in search results that would've misrepresented non-student roles.

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
  should feel like it belongs to the same team. Given the student/admin split above, this
  probably becomes two passes, not one: a warmer/simpler treatment for student-facing
  screens (D3) and a denser, data-tool-appropriate look for admin screens — rather than one
  visual language for both.
