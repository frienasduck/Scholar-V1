# Scholar-V1 — Preview Run Doc

How to bring up a live preview of this Next.js app from a fresh checkout.

## Reproduce the uncommitted artifacts

- **Env file**: copy `.env.local` from the main checkout into the worktree root (it is git-ignored, so a fresh checkout lacks it). It contains DB URLs, API keys and session secrets — never commit it, never log its values.
- **Dependencies**: install with the project's package manager:
  ```bash
  bun install
  ```
  (`bun.lock` is the frozen lockfile; `package.json` runs `prisma generate` on postinstall.)
- **Prisma client**: if `node_modules/.prisma/client` is missing or stale, regenerate:
  ```bash
  bunx prisma generate
  ```
  Note: `prisma validate` requires `DB_DATABASE_URL`/`DB_DATABASE_URL_UNPOOLED` in the environment; they are injected at deploy and live in `.env.local` locally.

## Run the dev server

- Default script: `bun run dev` → `next dev -p 3000` (logs to `dev.log`, writes `dev.pid`).
- **Port 3000 is frequently occupied** on this machine (a stale listener from an unrelated project holds it). Prefer the default when free, otherwise use a free port, e.g. 3001:
  ```bash
  nohup bunx next dev -p 3001 > .freebuff/preview-<thread-id>.log 2>&1 &
  ```
- Detached mode: run with `nohup ... &` so the process outlives the shell; capture the PID from `$!`.
- **Wait for readiness** before registering a preview — poll until the URL answers HTTP:
  ```bash
  curl -s -o /dev/null -w '%{http_code}\n' --max-time 10 http://localhost:3001
  # expect 200 (first compile can take 10–30 s)
  ```
- The app is a SPA-style Next app; the first request compiles on demand, so a slow first response is normal.
