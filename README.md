# DolphinLMS

DolphinLMS is a web app for a high school FIRST Robotics Competition team training and learning management system. It combines a React front end with Convex data, authentication, role-aware admin tools, training content, badge tracking, and equipment sign-off workflows.

## What It Does

- Student dashboard for assigned training, badge progress, and equipment status
- Training tracks with units, lessons, quizzes, reading, video, and exercise workflows
- Equipment catalog with safety tests, SOP uploads, and hands-on sign-off requests
- Badge catalog and admin-managed badge awards
- Admin tools for users, LMS content, badge definitions, reviews, and progress resets
- Convex Auth email/password sign-up and sign-in

## Tech Stack

- Bun for package management and scripts
- Vite, React, and strict TypeScript
- React Router 7 for routing
- Tailwind CSS v4 with shadcn/ui-style components
- Lucide icons
- Convex for backend data, live queries, mutations, auth, storage, and persistence
- Convex Auth with email/password
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
CONVEX_SITE_URL=
VITE_CONVEX_URL=
```

`CONVEX_SITE_URL` is read by `convex/auth.config.ts`. `VITE_` variables are visible to browser code, so do not put private API keys, tokens, or service secrets in a `VITE_` variable. Use Convex environment variables or another backend-only secret store for private values.

## Useful Commands

```bash
bun run dev
bun run convex:dev
bun run lint
bun run typecheck
bun run build
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
| `/admin` | Admin landing page |
| `/admin/lms` | Training and progress management |
| `/admin/badges` | Badge management |
| `/admin/people` | User and role management |
| `/auth` | Sign in and create account |

Editor routes also exist for training tracks, lessons, and badges. They require the appropriate authenticated role.

## Authentication and Roles

New accounts default to the `student` role when their profile is created.

Supported profile roles:

- `student`
- `instructor`
- `mentor`
- `guest`
- `admin`

For early development, use the Convex dashboard or CLI to run this mutation:

```ts
profiles:setRoleForEmail
```

Example arguments:

```json
{
  "email": "mentor@example.com",
  "role": "admin"
}
```

The first admin can be bootstrapped before any admin exists. After an admin exists, role changes require an authenticated admin.

## Project Structure

```text
convex/
  auth.ts        Convex Auth password provider setup
  http.ts        Convex Auth HTTP routes
  schema.ts      App data model and indexes
  profiles.ts    Profile, role, and account label functions
  training.ts    Training, lesson, quiz, and editor functions
  equipment.ts   Equipment, SOP, safety test, and sign-off functions
  badges.ts      Badge catalog and award functions
  adminLms.ts    Admin progress and review functions

src/
  components/    App shell and shared UI components
  pages/         Route-level screens
  providers/     Convex, theme, role preview, and toaster providers
  routes/        Root layout
  stores/        Temporary UI state
  lib/           Shared client utilities
```

## Data Rules

Convex is the source of truth for persisted LMS data: users, profiles, training tracks, units, lessons, progress, quizzes, submissions, badges, equipment, SOP files, sign-offs, and approvals.

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
