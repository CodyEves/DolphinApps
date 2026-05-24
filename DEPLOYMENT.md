# Deployment

DolphinLMS is a Vite single-page app backed by Convex. The recommended public hosting path is:

1. Deploy Convex for the backend.
2. Deploy the `dist/` static app to Vercel.
3. Point the hosted app at the production Convex URL.

## Preflight

Run these checks before deploying:

```bash
bun run check
git check-ignore -v .env.local .convex dist node_modules
rg -n --hidden -g '!node_modules' -g '!dist' -g '!.git' "api[_-]?key|secret|token|password|private[_-]?key|client[_-]?secret|bearer|authorization"
```

## Convex

Create or select a Convex project, then deploy the backend:

```bash
bun run deploy:convex
```

Record the production Convex URL. It will look like:

```text
https://your-deployment.convex.cloud
```

For Convex Auth, also set `CONVEX_SITE_URL` in the Convex deployment environment to the public URL where the web app will live, for example:

```text
https://your-site.vercel.app
```

If the public URL changes later, update `CONVEX_SITE_URL` to match.

## Vercel

Import the GitHub repository into Vercel and use these settings:

```text
Framework Preset: Vite
Install Command: bun install --frozen-lockfile
Build Command: bun run build
Output Directory: dist
```

Set this Vercel environment variable:

```text
VITE_CONVEX_URL=https://your-deployment.convex.cloud
```

Do not set private service keys in `VITE_` variables because Vite exposes them to browser code.

The included `vercel.json` rewrites all routes to `index.html`, so direct links and refreshes on React Router pages keep working.

## After Deploying

1. Open the public site.
2. Create the first account.
3. Use the Convex dashboard or CLI to run `profiles:setRoleForEmail` for the first admin.
4. Smoke-test `/`, `/auth`, `/dashboard`, `/training`, `/equipment`, and `/badges`.
5. Confirm the Convex production deployment has no test student data or private uploaded files that should not be public.
