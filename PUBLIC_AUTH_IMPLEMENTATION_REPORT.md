# SCHOLAR PUBLIC AUTHENTICATION — FINAL REPORT

2026-09-27. Continued from the existing dirty working tree; previous audit, Liquid Glass and personalization work was preserved.

## 1. Final Result

ORIGINAL LOGIN VISUALS RESTORED. NEW AUTH FUNCTIONALITY PRESERVED.

The original two-scene landing page and original glass card are restored, with public email authentication, Google authorization, recovery and Guest entry connected inside that card. Local code and fixture-backed flows are validated. LIVE DATABASE ACCEPTANCE: NOT TESTED. Real Google authorization and email delivery are NOT TESTED; their local credentials are absent.

## 2. UI Correction

The unwanted split-screen replacement was in `src/components/auth-screen.tsx` and its new `src/components/auth-screen.css`. The replacement layout, marketing panel, “Make room for your potential” copy and replacement stylesheet were removed. Original markup, inline glass recipes, Instrument Serif/Barlow typography, animations, spacing, feature cards and footer were recovered from the pre-auth source rather than reinterpreted.

Crystal hero background: RESTORED. Flower/crystal second scene: RESTORED. “Learning evolved”: RESTORED. Original navbar: RESTORED. Original centered glass login card: RESTORED. Actual Chrome inspection confirmed both original video assets reached readyState 4. A 96px card scroll margin keeps the original fixed navbar clear of the form heading; no new shell or background was introduced.

## 3. Intentional UI Changes Remaining

Only authentication-capability changes remain inside the original card: compact Sign in/Create account switch, name and confirmation fields for signup, password visibility control, Google button with the official four-color mark, Guest button, recovery/verification states, bounded loading/error messages and public rather than private-beta copy. Missing provider configuration is disclosed in a small note. Existing Group Study entry remains. The redundant class selector was removed, not redesigned.

## 4. Email Registration

Public registration uses strict bounded JSON, normalized email, existing scrypt password hashing, password confirmation, IP/account rate limits and database uniqueness. New accounts are USER/Free with zero coins; no Developer Access or Plus privileges are granted. Successful server-session creation returns to `/`, where the existing Your Scholar provider owns first-login routing. The existing service bootstrap identity is reserved against public pre-hijacking; it is not an ordinary-user beta allowlist. Duplicate registration returns a controlled conflict, so signup is not claimed to conceal account existence completely. Verification email is optional and scheduled after response, not a prerequisite for ordinary access. Real database registration: NOT TESTED.

## 5. Email Login

Public login accepts existing credentials without the retired beta allowlist. Unknown identities perform password-hash padding work; wrong/unknown credentials have the same public error. Authentication restores saved account identity and class. Successful login replaces the auth history entry with `/`; account hydration selects Dashboard or legitimately unfinished Your Scholar. Password/session-version checks are serialized against credential reset. Real database login: NOT TESTED.

## 6. Google Sign-In

Implemented server authorization-code flow with state, browser binding, nonce, PKCE S256, fixed canonical callback, expiring single-use database attempts and bounded code exchange. Google’s official library verifies token signature, audience, issuer and expiry; additional checks require the expected nonce, stable subject and verified email. Provider access/refresh/ID tokens are not persisted. Newly created Google accounts use the same USER/Free identity and Your Scholar flow; returning linked users reuse their account. Local unconfigured Google entry is disabled honestly. Real provider acceptance: NOT TESTED. Protocol reference: [Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect).

## 7. Account Linking

No automatic signed-out email merge. An existing email asks the visitor to sign in with its existing method and explicitly connect Google in Account Settings. Linking binds the original authenticated user and exact session, then rechecks that session under the user lock after provider exchange. Cross-user subjects, conflicting emails, revoked/switched sessions and a second conflicting Google identity are rejected. Existing data, entitlements and Group Study identity are retained. Offline/fixture security checks passed; live database linking was not exercised.

## 8. Password Recovery

Reuses the existing Resend sender, with a ten-second delivery deadline. Requests give generic responses and defer lookup/delivery until after response. Random single-use tokens are stored only as hashes: reset expiry 15 minutes, verification expiry 24 hours. Recovery links use `/login#reset=…` or `/login#verify=…`; the client immediately clears fragments and sends tokens only in bounded POST bodies. Reset consumption checks expiry, purpose, current email and credential version under a user lock, changes the hash, increments sessionVersion and revokes all sessions and pending link attempts. No automatic login follows reset. Unconfigured local recovery is disclosed without blocking login/Guest. Actual delivery: NOT TESTED.

## 9. Session Security

Preserved opaque, hashed, revocable seven-day server sessions and HttpOnly cookies, Secure in production and SameSite=Lax. Login rotates the current session and clears privileged cookies. Logout revokes the server session and clears relevant cookies; JSON mutations enforce Origin/Fetch Metadata and body bounds. Password reset invalidates all account sessions and version-bound privileged state. Auth responses are private/no-store. Auth-link pages use no-referrer. Application dev logging excludes OAuth callback code/state; production platform access-log redaction remains unverified.

## 10. Public Access / Beta Gate Removal

Ordinary registration/login/session restoration no longer depend on beta allowlists, invitations or a developer password. The compatibility beta helper reports public registration and no private-beta restriction. Stale beta copy was updated in auth, privacy, updates and one personalization permission sentence. This does not remove private-feature authentication, Group Study ownership/hosting restrictions or paid entitlements.

## 11. Developer Access

Existing Developer Access remains separately authenticated and version-bound. Public signup cannot select a privileged role or acquire developer privileges through the retired beta policy. Existing service-identity protections remain. Focused Developer Access tests passed; no developer configuration or production credentials were changed.

## 12. Guest Mode

Guest entry remains local-only, with the existing warning, dismissal/expiry behavior and private-feature restrictions. Server identity, not a forged client flag, grants authenticated access. Auth returns through the existing account-workspace ownership journal; Guest work is not destructively wiped before switching accounts. Guest UI and server-policy coverage passed. No Guest account was fabricated in a live database.

## 13. Your Scholar Integration

New email/Google accounts return to `/` and use the existing NOT_STARTED first-login flow. Returning COMPLETED/SKIPPED accounts bypass new-account questions; IN_PROGRESS resumes its saved stage and ANALYZING resumes the existing journey. Planetary onboarding, Scholar Today and Learning Profile design/logic were not rewritten. Fixture-backed auth routing and focused personalization regressions validate this integration; live persistence is not claimed.

## 14. Class Selection Decision

Removed only the original card’s Class 9/Class 11 selector. New accounts select study level once in Your Scholar. Returning accounts use their persisted class/profile through server session restoration. Class 11 remains the existing temporary backend default before new-account personalization; it is not an extra question or a client override of returning accounts.

## 15. Database Changes

Both pending additive migrations are preserved:

- `prisma/migrations/20260927000000_learning_profile/migration.sql` — preceding personalization work.
- `prisma/migrations/20260927010000_public_auth/migration.sql` — nullable passwordHash for Google-only accounts, emailVerifiedAt, OAuthAccount, OAuthAttempt and AuthActionToken, with uniqueness/index/ownership constraints.

LOCAL DB MIGRATION APPLIED: NO. PRODUCTION DB MIGRATION APPLIED: NO. No isolated PostgreSQL database was available. An unknown remote-looking DATABASE_URL was not repurposed. LIVE DATABASE ACCEPTANCE: NOT TESTED. These migrations must be applied in a deliberately selected environment before the new database-backed flows are usable there.

## 16. Google Environment Setup

Server variable names only: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `AUTH_BASE_URL`. Existing recovery integration additionally needs `RESEND_API_KEY`, `RESEND_FROM_EMAIL`. Local Google and email credentials are absent. No secret values were added to reports, browser code, commits or logs. `.env.example` contains empty placeholders only.

## 17. Google Redirect URI Setup

Register a Google **Web application** OAuth client with these exact authorized redirect URIs:

- Local: `http://localhost:3000/api/auth/google/callback`
- Production: `https://scholar-v1.vercel.app/api/auth/google/callback`

The application route is `GET /api/auth/google/callback`; authorization begins with bounded `POST /api/auth/google/start`. No wildcard, external return URL or client-provided callback is accepted. This server-code implementation does not require a Google JavaScript SDK origin; if configuring origins for a future browser SDK, use the corresponding bare origins, not callback paths. Configure consent branding/audience and testing/publication in Google Console before real users test. [Google web-server OAuth setup](https://developers.google.com/identity/protocols/oauth2/web-server).

## 18. Tests

Final isolated Bun runs: **208 passing tests across 16 files**, without rerunning the giant platform audit. Exact commands and counts:

| Command | Passed |
| --- | ---: |
| `bun test tests/private-beta-auth.test.ts` | 19 |
| `bun test tests/google-auth.test.ts` | 16 |
| `bun test tests/google-claims.test.ts` | 15 |
| `bun test tests/auth-recovery.test.ts` | 12 |
| `bun test tests/auth-api.test.ts` | 10 |
| `bun test tests/developer-access.test.ts` | 19 |
| `bun test tests/guest-mode-security.test.ts tests/subscription-security.test.ts tests/group-study-policy.test.ts tests/postgres-auth-security.test.ts tests/postgres-migration-coverage.test.ts tests/account-workspace.test.ts` | 44 |
| `bun test tests/personalization-engine.test.ts tests/personalization-security.test.ts` | 49 |
| `bun test tests/entitlements-fail-closed.test.ts` | 4 |
| `bun test tests/group-study-host-repair.test.ts` | 20 |

Google claims tests use offline ephemeral RSA keys with the real Google verification library; no credentials or external OAuth success are fabricated. Mocked API/data browser fixtures are not live database/provider acceptance. Earlier failing browser fixture/selectors were corrected; only final successful runs are counted below.

Chrome: `node node_modules/@playwright/test/cli.js test tests/public-auth.spec.ts --reporter=line --workers=1` — **8 passed**.

Edge, with `SCHOLAR_QA_BROWSER` selecting installed Edge: `node node_modules/@playwright/test/cli.js test tests/public-auth.spec.ts --grep 'original landing|keyboard submit' --reporter=line --workers=1` — **2 passed**.

Focused existing Guest/personalization command: `node node_modules/@playwright/test/cli.js test tests/guest-mode.spec.ts tests/personalization.spec.ts --grep 'guest entry|saved drafts resume|Guest and completed users|planet resume' --reporter=line --workers=1` — **4 passed (28.6s)**. An initial run passed three tests but timed out on a reload startup overlay. The resume test now explicitly waits for startup readiness after reload; its isolated rerun and final grouped rerun both passed. No startup or personalization product behavior was changed to bypass the overlay. Final browser total: **14 passing checks** (8 Chrome public-auth, 2 Edge, 4 focused Chrome regressions).

## 19. Browser QA

Chrome and Edge checked both auth modes at: **1920×1080, 1440×900, 1366×768, 1280×720, 1024×600, 834×1194, 768×1024, 430×932, 390×844, 360×800, 320×568, 844×390**. This includes all six correction-required sizes. Assertions cover original assets/navbar/heading/card, reachable fields, no horizontal overflow, keyboard submit, show/hide, controlled errors, duplicate-submit protection and new/returning routing.

An additional unmocked Chrome visit inspected the actual original backgrounds and captured the card at **1440×900, 1366×768, 1024×600, 390×844, 320×568, 844×390**. Both videos loaded, with no page or console errors and no horizontal overflow. Original visual source and existing pre-auth screenshot were compared. The restored mobile card scrolls normally; it is not forced into a clipped single viewport. Evidence: `test-artifacts/auth-restored-hero-*.png`, `test-artifacts/auth-restored-card-*.png`. Capture scrolling was made instantaneous so evidence is not taken mid-scroll. Physical devices, Safari and Firefox/WebKit: NOT TESTED.

## 20. Build Validation

- Prisma: client generation and schema validation PASSED earlier in this same task using process-scoped synthetic local validation DSNs; no database connection or migration.
- `bunx tsc --noEmit`: PASSED after UI restoration.
- `bun run lint`: PASSED after UI restoration.
- `bun run build`: PASSED after UI restoration; optimized Next.js 16.3.6 compilation, TypeScript and all 47 static pages completed.
- `git diff --check`: PASSED; normal Windows LF/CRLF informational warnings are not whitespace errors.

No dependency reinstall, destructive repository reset or production migration was performed during the visual correction. The local development server remains available at `http://localhost:3000`.

## 21. Files Created

Auth task additions (excluding prior untracked audit/personalization files and generated QA screenshots):

```text
prisma/migrations/20260927010000_public_auth/migration.sql
src/lib/auth/config.ts
src/lib/auth/request-security.ts
src/lib/auth/flow-errors.ts
src/lib/auth/google-claims.ts
src/lib/auth/google.ts
src/lib/auth/recovery.ts
src/app/api/auth/config/route.ts
src/app/api/auth/google/start/route.ts
src/app/api/auth/google/callback/route.ts
src/app/api/auth/recovery/route.ts
src/app/api/auth/account/route.ts
src/app/login/page.tsx
src/components/account-security.tsx
tests/google-auth.test.ts
tests/google-claims.test.ts
tests/auth-recovery.test.ts
tests/auth-api.test.ts
tests/public-auth.spec.ts
PUBLIC_AUTH_IMPLEMENTATION_REPORT.md
```

## 22. Files Modified

Auth-task changes below are layered on existing user/audit changes, not replacements of those changes:

```text
.env.example
package.json
bun.lock
next.config.ts
prisma/schema.prisma
src/lib/auth/beta.ts
src/lib/auth/session.ts
src/lib/subscriptions/email.ts
src/app/api/auth/register/route.ts
src/app/api/auth/login/route.ts
src/app/api/auth/logout/route.ts
src/app/api/developer-access/route.ts (comment only)
src/app/privacy/page.tsx
src/app/updates/page.tsx
src/components/auth-screen.tsx
src/components/views/settings.tsx
src/lib/personalization/engine.ts (permission-copy sentence only)
tests/private-beta-auth.test.ts
tests/developer-access.test.ts
tests/guest-mode.spec.ts
tests/personalization.spec.ts (explicit startup-readiness wait after reload)
worklog.md
```

Declared the already-transitive official `google-auth-library` as exact direct version 10.9.0, without running install scripts. The surgical visual correction primarily restores AuthScreen and deletes its unwanted new stylesheet; auth/backend files were preserved. AuthScreen’s final diff against HEAD is smaller than the discarded split-screen replacement. No unrelated previous dirty-file changes are attributed to this auth task.

## 23. Files Removed

`src/components/auth-screen.css` — unwanted, newly introduced split-screen design only. No pre-existing backend, migration, asset, personalization, Liquid Glass or Android file was removed. Previous QA artifacts were preserved; superseded split-screen screenshots are not current acceptance evidence.

## 24. Remaining Risks

Live database acceptance, real OAuth callback/linking, real email delivery and production session behavior remain NOT TESTED. Pending migrations and configured Google/Resend credentials are prerequisites. Google consent publication, exact production callback configuration, sender/domain verification and platform-level OAuth log redaction require environment-level confirmation. No production deployment was performed. Existing unrelated dependency/audit risks remain documented in the preceding audit rather than being silently declared resolved. No physical-device or Safari acceptance is claimed.

## 25. Git Status

Nothing staged. Nothing committed. Nothing pushed. Nothing deployed. HEAD remains `01d81351233d8fc8106b417462c647f2be9675a3`; index diff is empty. Existing extensive dirty audit/Liquid Glass/personalization work was preserved. No tracked Android changes were made; the pre-existing untracked APK remains untouched. No destructive git operation was used.
