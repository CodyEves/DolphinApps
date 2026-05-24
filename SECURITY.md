# Security Notes

This project is safe to share only when local configuration stays local.

## Do Not Commit

- `.env`, `.env.*`, and `.env.local` files with real Convex deployment values
- `.convex/` local deployment metadata
- Build output such as `dist/`
- Logs, coverage reports, and dependency folders

## Environment Variables

Use `.env.example` as the public template. Each developer should copy it to `.env.local` and fill in values from their own Convex deployment.

The Vite app exposes variables prefixed with `VITE_` to browser code, so never put private API keys in a `VITE_` variable. Server-only secrets should stay in Convex environment variables or another backend-only secret store.

## Before Sharing Publicly

Run these checks before pushing or publishing:

```bash
git status --short
git check-ignore -v .env.local .convex dist node_modules
rg -n --hidden -g '!node_modules' -g '!dist' -g '!.git' "api[_-]?key|secret|token|password|private[_-]?key|client[_-]?secret|bearer|authorization"
bun run lint
bun run typecheck
bun run build
```
