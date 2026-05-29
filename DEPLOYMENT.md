# Deployment

Dolphin Apps is a Vite single-page app backed by Convex. The recommended public hosting path is:

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

Convex automatically provides `CONVEX_SITE_URL`; do not add or override it in the dashboard. It is the `.convex.site` HTTP Actions URL used as the auth issuer, not your Vercel URL.

Convex Auth also needs a user-set `SITE_URL` pointing at the public web app, for example:

```text
SITE_URL=https://your-site.vercel.app
```

For Convex Auth password sign-in, make sure the production deployment has the auth signing keys created by the Convex Auth setup:

```text
SITE_URL
JWT_PRIVATE_KEY
JWKS
```

If these are missing, run the Convex Auth setup/sync command for your production deployment or copy the generated production values into the Convex dashboard. Missing signing keys commonly show up as `auth:signIn` server errors in production.

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
