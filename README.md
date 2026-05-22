# DolphinLMS

DolphinLMS is a starter web app for a high school FIRST Robotics Competition team training and learning management system. The first version is intentionally small: it proves the app shell, routing, theme system, shadcn/ui components, Convex connection, Convex Auth, role-aware placeholders, and a draft LMS data model.

## Tech Stack

- Bun for package management and scripts
- Vite, React, and strict TypeScript
- React Router 7 for routes and layouts
- Tailwind CSS v4 with `@tailwindcss/vite`
- shadcn/ui-style components with CSS variable theming
- Lucide icons
- Convex for backend data, live queries, mutations, auth, and persistence
- Convex Auth with email/password
- Zustand only for temporary UI state
- next-themes for light/dark/system mode
- Sonner for toast notifications

## First-Time Setup

Install dependencies:

```bash
bun install
```

Start Convex:

```bash
bun run convex:dev
```

You can also use the standard Convex command:

```bash
bunx convex dev
```

Convex will create local project metadata and an `.env.local` file with:

```bash
VITE_CONVEX_URL=https://your-deployment.convex.cloud
```

Keep the Convex terminal running. In a second terminal, start the Vite app:

```bash
bun run dev
```

Open the local URL printed by Vite, usually `http://localhost:5173`.

This workspace was initially configured with a local anonymous Convex deployment because the CLI was not logged in. To attach it to your personal Convex team, run:

```bash
bun node_modules/convex/bin/main.js login
bun run convex:dev
```

Then follow the Convex prompts to link or create the project under your account.

## Useful Commands

```bash
bun run dev
bun run convex:dev
bun run typecheck
bun run build
bun run preview
```

If Convex asks to configure authentication, use the generated values it provides. Convex Auth is wired in `convex/auth.ts` with the Password provider.

## Authentication and Roles

The app uses Convex Auth email/password sign-up and sign-in. New accounts default to the `student` role when their profile is created.

Roles are stored in the Convex `profiles` table:

- `student`
- `instructor`
- `admin`

For early development, use the Convex dashboard or CLI to run the mutation:

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
  auth.ts       Convex Auth password provider setup
  demo.ts       Small live training demo query/mutations
  http.ts       Convex Auth HTTP routes
  profiles.ts   Profile and role functions
  schema.ts     Draft LMS data model

src/
  components/   App shell and shadcn/ui-style components
  pages/        Route pages
  providers/    Convex, theme, and toaster providers
  routes/       Root layout
  stores/       Zustand UI-only state
```

## Data Rules

Convex is the source of truth for persisted LMS data: users, profiles, training tracks, units, lessons, progress, quizzes, submissions, badges, equipment, and approvals.

Zustand is only for temporary interface state such as sidebar state, selected local UI tab, and selected training item. Do not copy Convex query results into Zustand.

## What Works Now

- App shell with responsive sidebar and mobile navigation
- Light, dark, and system theme mode
- shadcn/ui-style buttons, cards, tabs, sheets, dropdowns, forms, badges, progress, and toasts
- React Router pages for Home, Dashboard, Training, Equipment, Badges, Admin, and Auth
- Convex Auth email/password setup
- Role-aware dashboard/admin placeholders
- Draft Convex schema for the future LMS
- Demo training seed mutation, live training query, and lesson progress mutation

## Next Good Features

- Real course editor for admins
- Embedded YouTube lessons with watch progress
- Quiz and safety test builder
- Exercise submission and mentor review flow
- Equipment sign-off request and approval queue
- Badge awarding rules
- Student progress reports for instructors
- Invitation or roster import workflow for team members
