# Dolphin Apps

Dolphin Apps is the shared operations suite for robotics teams. It combines student learning, equipment readiness, shop attendance, robot parts tracking, badges, and mentor/admin management in one React + Convex application.

## What It Does

- Student dashboard for assigned training, badge progress, equipment status, and next steps
- Training tracks with units, lessons, quizzes, reading, video, and exercise workflows
- Equipment catalog with safety tests, SOP uploads, and hands-on sign-off requests
- Badge catalog and admin-managed badge awards
- Shop attendance with live sessions, check-in codes, event attendance, corrections, reports, and Slack linking
- Robot parts workspace with part numbers, BOMs, manufacturing status, transmissions, and order requests
- Mentor dashboard for team learning progress, missing work, pending reviews, and student next actions
- Admin tools for users, learning content, badge definitions, reviews, and progress resets
- Admin-provisioned username/password accounts with one-time setup and reset links

## Tech Stack

- Bun for package management and scripts
- Vite, React, and strict TypeScript
- React Router 7 for routing
- Tailwind CSS v4 with shadcn/ui-style components
- Lucide icons
- Convex for backend data, live queries, mutations, auth, storage, and persistence
- Convex Auth with admin-provisioned username/password credentials
- Zustand for temporary UI-only state
- next-themes for light/dark/system mode
- Sonner for toast notifications

## First-Time Setup

Install dependencies:

```bash
bun install
```

Create your local environment file:

```bash
cp .env.example .env.local
```

Start Convex:

```bash
bun run convex:dev
```

Convex will create local project metadata in `.convex/` and print the values needed for `.env.local`.

Keep the Convex terminal running. In a second terminal, start the Vite app:

```bash
bun run dev
```

Open the local URL printed by Vite, usually `http://localhost:5173`.

## Environment Variables

Public template values live in `.env.example`. Real values belong in `.env.local`, which is ignored by git.

```bash
CONVEX_DEPLOYMENT=
SITE_URL=
VITE_CONVEX_URL=
```

`SITE_URL` is used by Convex Auth and should be your public web app URL in production, such as `https://your-site.vercel.app`. `CONVEX_SITE_URL` is a Convex-provided system variable used by `convex/auth.config.ts`; do not add or override it yourself. `VITE_` variables are visible to browser code, so do not put private API keys, tokens, or service secrets in a `VITE_` variable. Use Convex environment variables or another backend-only secret store for private values.

## Useful Commands

```bash
bun run dev
bun run convex:dev
bun run lint
bun run typecheck
bun run build
bun run check
bun run preview
```

## App Routes

| Route | Purpose |
| --- | --- |
| `/` | Home overview |
| `/dashboard` | Student and reviewer dashboard |
| `/training` | Published training track list |
| `/training/tracks/:trackId` | Student track view |
| `/training/lessons/:lessonId` | Student lesson view |
| `/equipment` | Equipment catalog |
| `/equipment/:equipmentId` | Equipment detail, safety test, and sign-off flow |
| `/reviews` | Instructor/admin review queue |
| `/badges` | Badge catalog and earned badges |
| `/badges/awards` | Admin badge award records |
| `/parts` | Robot parts workspace |
| `/parts/dashboard` | Parts, fab, order, and transmission overview |
| `/shop` | Shop attendance overview and student check-in |
| `/shop/display` | Kiosk/display code view |
| `/shop/review` | Attendance correction review |
| `/shop/reports` | Hours reporting |
| `/management` | Management landing page |
| `/management/team` | Team learning progress and next-action dashboard |
| `/management/lms` | Training and progress management |
| `/management/badges` | Badge management |
| `/management/people` | User and role management |
| `/auth` | Username/password sign in |
| `/auth/setup` | One-time password setup link |
| `/auth/reset` | One-time password reset link |

Editor routes also exist for training tracks, lessons, badges, equipment, and parts records. They require the appropriate authenticated role.

## Authentication and Roles

Accounts are provisioned by admins instead of open public sign-up. Admins create
a student, mentor, guest, or admin account in `/admin/people`, then copy a
one-time setup link for that person to create their password. Password recovery
also uses admin-generated one-time reset links, so student email addresses are
not required for access.

Supported profile roles:

- `student`
- `instructor`
- `mentor`
- `guest`
- `kiosk`
- `admin`

For first-admin bootstrap, use the Convex dashboard or CLI to run this mutation
before any admin profile exists:

```ts
access:createProvisionedAccount
```

Example arguments:

```json
{
  "displayName": "Lead Mentor",
  "accountLabel": "admin",
  "setupTokenHash": "sha256-hex-of-a-random-token",
  "setupExpiresAt": 1798761600000
}
```

Then open `/auth/setup?token=<the-random-token>` to set the first admin
password. After an admin exists, account creation and reset links require an
authenticated active admin.

## Project Structure

```text
convex/
  auth.ts        Convex Auth username credential setup
  access.ts      Provisioned usernames, setup links, and reset links
  http.ts        Convex Auth HTTP routes
  schema.ts      App data model and indexes
  profiles.ts    Profile, role, and account label functions
  training.ts    Training, lesson, quiz, and editor functions
  equipment.ts   Equipment, SOP, safety test, and sign-off functions
  badges.ts      Badge catalog and award functions
  adminLms.ts    Admin progress and review functions
  shopAttendance.ts Shop sessions, attendance, reports, and events
  parts.ts       Robot part records and lifecycle events

src/
  components/    App shell and shared UI components
  pages/         Route-level screens
  providers/     Convex, theme, role preview, and toaster providers
  routes/        Root layout
  stores/        Temporary UI state
  lib/           Shared client utilities
```

## Data Rules

Convex is the source of truth for persisted Dolphin Apps data: users, profiles, training tracks, units, lessons, progress, quizzes, submissions, badges, equipment, SOP files, sign-offs, shop attendance, robot parts, order requests, and approvals.

Zustand is only for temporary interface state such as sidebar state, selected local UI tabs, and selected training items. Do not copy Convex query results into Zustand.

## Sharing Checklist

Before pushing publicly or deploying:

```bash
git status --short
git check-ignore -v .env.local .convex dist node_modules
rg -n --hidden -g '!node_modules' -g '!dist' -g '!.git' "api[_-]?key|secret|token|password|private[_-]?key|client[_-]?secret|bearer|authorization"
bun run lint
bun run typecheck
bun run build
```

Also confirm that the Convex deployment you point production at does not contain test accounts, private student data, or uploaded files that should not be public.

## Security Notes

See [SECURITY.md](./SECURITY.md) for the short version of what should never be committed.

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for the public hosting checklist and Vercel + Convex setup.

