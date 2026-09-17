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
- **Port note (updated):** port 3000 was NOT occupied in the latest run and the server bound it fine; still, check first with `netstat -ano -p tcp | grep ":3000 "` and only pick a free fallback port if taken.
- **Windows detach recipe (verified):** `bun` has no `.cmd` shim on this machine — `Start-Process -FilePath 'bun.cmd'` FAILS. Use the real exe directly:
  ```powershell
  powershell -NoProfile -Command "(Start-Process -FilePath 'C:\Users\Lenovo\.bun\bin\bun.exe' -ArgumentList 'run','dev' -WorkingDirectory 'C:\Users\Lenovo\Desktop\SCHOLAR\Scholar-V1' -RedirectStandardOutput '<log>' -RedirectStandardError '<log>.err' -WindowStyle Hidden -PassThru).Id"
  ```
  stdout and stderr MUST go to different files (PowerShell requirement). Expect the command to return no output and to take >30 s to return — the server is up anyway; confirm with `netstat`/`Get-Process` and poll the URL.
- **Wait for readiness** before registering a preview — poll until the URL answers HTTP:
  ```bash
  curl -s -o /dev/null -w '%{http_code}\n' --max-time 30 http://localhost:3000
  # expect 200 (first compile can take 10–30 s)
  ```
- The app is a SPA-style Next app; the first request compiles on demand, so a slow first response is normal.
- `/group-study` standalone route loads Google Fonts (Sora + JetBrains Mono) via `next/font` in its layout, plus a CloudFront video — first hit can be slower.
- Note: `prisma validate`/`migrate` need `DB_DATABASE_URL`/`DB_DATABASE_URL_UNPOOLED` env overrides locally; the dev server itself reads them from `.env.local`.
