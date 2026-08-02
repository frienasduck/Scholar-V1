# Scholar PostgreSQL authentication deployment

Scholar now uses PostgreSQL for permanent accounts and database-backed sessions. SQLite is not a supported production database on Vercel.

## Production setup

1. In the Vercel project, open **Storage** or **Marketplace** and add a Neon Postgres database.
2. Keep the pooled PostgreSQL connection supplied by the connected Neon integration as `DB_DATABASE_URL` for Production and Preview.
3. Keep the direct PostgreSQL connection supplied by the connected Neon integration as `DB_DATABASE_URL_UNPOOLED` for Production and Preview.
4. Add a cryptographically random value of at least 32 characters as `AUTH_SESSION_SECRET` for Production and Preview.
5. Pull variables locally without committing them: `vercel env pull .env.local --yes`.
6. Apply the checked-in baseline once: `bun run db:migrate:deploy`.
7. Build and deploy Scholar.
8. Create the administrator account normally, then run `bun run admin:grant` once in a trusted environment connected to production.

Do not put connection strings or session secrets in client code, Git, or variables prefixed with `NEXT_PUBLIC_`.

## Existing local SQLite data

The previous local database contains real Scholar records, so it is not discarded automatically. After the PostgreSQL baseline has been applied, run the one-time transfer from a trusted machine:

```powershell
$env:LEGACY_SQLITE_PATH="E:\DOWNLOADS\scholar-v2-codex-import\scholar\prisma\dev.db"
$env:DB_DATABASE_URL="<target PostgreSQL URL>"
$env:DB_DATABASE_URL_UNPOOLED="<target direct PostgreSQL URL>"
bun run db:transfer:sqlite
```

The transfer preserves IDs, normalized emails, password hashes, roles, subscriptions, payment requests, coins, file metadata, and audit events. It intentionally does not transfer old sessions, so users must sign in again. It refuses a SQLite target and refuses normalized duplicate emails.

## Verification

After deployment, verify signup, refresh persistence, logout, login, wrong-password rejection, duplicate registration, Guest Mode, normal-user admin denial, administrator access, and Plus restoration. `prisma migrate dev` and `prisma migrate reset` must never be run against production.
