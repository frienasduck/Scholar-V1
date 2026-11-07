# Project Shrinking Scholar — Verified Inventory

Captured in the existing local working tree on 2026-11-07. This inventory was
checked against source files and the running application, not copied from an
earlier agent report.

## 1. Repository safety

- Repository: `C:\Users\Lenovo\Desktop\SCHOLAR\Scholar-V1`
- Branch: `main`
- Working tree already contained **44 modified files** and several untracked
  files before this work. They were preserved; no reset, restore, clean,
  commit, push or deployment was performed.
- Recovery point created for every file edited in this task:
  `C:\Users\Lenovo\Desktop\SCHOLAR\.rollback-backups\2026-11-07-shrinking-scholar\`
- No database migration was executed and no schema file was changed.
- No paid AI provider was called during implementation or testing.

## 2. Actual architecture

| Concern | Implementation |
|---|---|
| Framework | Next.js 16.3.6 (App Router, Turbopack dev), React 19, TypeScript strict |
| Styling | Tailwind CSS 4 + Scholar Liquid Velocity 3.x CSS |
| Motion | Anime.js 4.5, Framer Motion, shared `velocity-motion` layer |
| State | Zustand 5 (`src/lib/store.ts`) plus profile-scoped browser storage |
| Persistence | Prisma 6 / PostgreSQL (`prisma/schema.prisma`) and localStorage |
| Auth | `/api/auth/*`, `src/lib/auth/session.ts` |
| URL model | Single-segment workspace routes: `src/app/[...path]/page.tsx`, validated by `src/lib/routes.ts` |
| Navigation | `src/lib/nav.ts` → `src/components/app-shell.tsx`; `history.pushState` + `popstate`; mobile dock `src/components/liquid-glass/mobile-liquid-dock.tsx` |
| Merger registry | `src/lib/shrinking-scholar.ts` (workspaces, modes, legacy map, aliases, deep-link targets) |
| Workspace shell | `src/components/workspaces/workspace-tabs.tsx` |
| View loading | `next/dynamic` per view in `app-shell.tsx`; workspace modes lazy-load their own views |

Important consequence: this application does **not** have one route file per
feature. Adding a new route file or router abstraction would duplicate the
existing mechanism. The consolidation therefore uses the existing view-id +
mode system.

## 3. Destination inventory (before this task)

### Question Practice family

| Old destination | View file | Storage / APIs | Permissions |
|---|---|---|---|
| Question Practice / Practice | `src/components/views/practice.tsx` | `lib/question-bank.ts`, `lib/ebook-question-bank.ts`, profile-scoped practice progress | Standard |
| Quiz | `src/components/views/quiz.tsx`, `src/components/views/quiz/*` | `lib/quizzes-*.ts`, `lib/quiz-mistakes.ts`, local quiz history | Standard / quiz quotas |
| Past Papers | `src/components/views/past-papers.tsx` | past-paper dataset + mistake tracker in browser storage | Standard |

### Doubt family

| Old destination | View file | Storage / APIs | Permissions |
|---|---|---|---|
| Doubt History | `src/components/views/doubt-history.tsx` | `src/lib/v2/intelligence` mistakes, saved doubts, `doubt-history.css` styles inline | User-scoped records |
| Answer Lab | `src/components/views/answer-lab.tsx` | `askAI` / `/api/ai` pipeline, saved answer history | Standard; AI provider limits |

### Experiment family

| Old destination | View file | Storage / APIs | Permissions |
|---|---|---|---|
| Practical Lab / Experimental Lab | `src/components/views/lab.tsx`, `lab-interactive.tsx` | simulation state in browser; lab data in `src/lib` / `src/data` | Standard |
| Experimental Lab Plus / Practicals | `src/components/views/practicals.tsx` | saved practical records | Entitlement `practical_lab` (server-authoritative) |

### Study media

| Old destination | View file | Availability |
|---|---|---|
| LAMTube (`nigtube`) | `src/components/views/nigtube.tsx`, `src/lib/lamtube/*`, `/api/lamtube*` | Paused by `src/lib/section-availability.ts` |
| Study Music | `src/components/views/music.tsx`, `src/lib/music-store.ts`, `/api/study-music*` | Paused by `src/lib/section-availability.ts` |

### Scholar Intelligence

| Piece | Location |
|---|---|
| Workspace view | `src/components/views/intelligence.tsx` |
| Consent | `src/lib/v2/intelligence/consent.ts` (profile-scoped, `granted` / `declined` / unset) |
| Engine | `src/lib/v2/intelligence/*` (mastery, mistakes, weak topics, revision queue, brief) |
| Settings UI | `src/components/settings/scholar-intelligence-settings.tsx` |
| APIs | `/api/v2/intelligence`, `/api/personalization`, `/api/personalization/analyze` |
| Data | Prisma `MasteryRecord`, `PracticeAttempt`, `MistakeRecord`, `RevisionItem`; derived browser keys |

### LAM AI family

| Old destination | View file | Capability |
|---|---|---|
| LAM AI / Live Tutor | `src/components/views/live-tutor.tsx` | streaming chat, personality, memory, sessions, attachments, `@` mention |
| AI Tutor | `src/components/views/ai-tutor.tsx` | class/subject/chapter tutoring, image upload, teaching personae |
| AI Tools | `src/components/views/ai-tools.tsx` | `ToolContent` router with 12 real tool implementations |

Backends: `/api/lam/chat`, `/api/lam/live/*`, `/api/lam/identity`, `/api/ai`,
`/api/ai-image`, `/api/ai/slideshow`, `/api/ocr`, `/api/transcribe`.
Attachments: `src/lib/lam/attachments.ts` accepts text/Markdown/CSV/JSON/PDF,
15 MB limit, up to 30 PDF pages, 6,000 excerpt characters, four attachments per
message. Images are deliberately rejected by this attachment reader.

Existing AI Tools implementations (all real `ToolContent` cases):
`ai-pdf-studio`, `mistake-analyzer`, `memory-predictor`, `academic-coach`,
`one-night-exam`, `homework-scanner`, `daily-briefing`, `chapter-builder`,
`life-saver`, `study-companion`, `aisig`, `slideshow-maker`.

### Resources family

| Old destination | View file | Storage / APIs |
|---|---|---|
| Resources | `src/components/views/resources.tsx`, `src/components/resources/*` | `/api/resources*`, `StudyResource`, `ResourceChunk` |
| Downloads | `src/components/views/downloads.tsx` | profile-scoped `dl-downloaded` and `dl-offline`; generated Blobs |

## 4. Permissions and access

- Server authority: `src/lib/subscriptions/entitlements.ts` (imports
  `server-only`) and `/api/v2/entitlements`.
- Client presentation: `src/components/subscriptions/subscription-provider.tsx`,
  `PlusGate`, `ScholarPlusView`.
- Guest restrictions: `GUEST_RESTRICTED_VIEWS` in `app-shell.tsx` includes
  `lam-ai`; guests also cannot use Files/Store/Plus/Subscription Payment.
- Plus gates relevant to mergers: `lam_ai`, `practical_lab`, `aisig`,
  `homework_scanner`, `slideshow_generation_plus`, `scholar_intelligence`.
- No client-side-only gate was added or removed. The server remains the
  boundary.

## 5. Gaps found in the working tree before this task

1. `Doubt Lab` existed as a route but was missing from `NAV_ITEMS`, so the
   merged destination had no primary sidebar entry.
2. Doubt History used `object-position: 72% 50%` on a 1920×1080 background
   video. On portrait screens this pushed the focal area off-centre and cropped
   the opposite side.
3. LAM AI Plugins was a flat 12-card grid. There was no category structure,
   availability state, required-attachment metadata, or shared registry.
4. The composer `@` menu could select a plugin but executed it immediately; it
   had no keyboard arrow navigation and no removable plugin chip.
5. Resources/Downloads switched panels with a fade. There was no directional
   slide and the library unmounted on the switch.
6. Scholar Intelligence consent existed inside Settings but no first-time
   authenticated prompt was mounted, so a new account was never asked.
7. The required inventory and implementation reports did not exist.

## 6. Migration plan used

- Keep canonical route names (`question-practice`, `doubt-lab`,
  `experiment-lab`, `study-media`, `lam-ai`, `resources`).
- Resolve every old view id through `LEGACY_VIEW_MAP` in
  `src/lib/shrinking-scholar.ts`; never delete the legacy route from
  `SCHOLAR_ROUTES`.
- Keep each real view file and lazy-load it inside its merged workspace.
- Keep existing storage keys and APIs untouched; add no duplicate store.
- Keep paused services paused by rendering the existing `SectionShutdown`.
- Keep Plus checks in place through `PlusGate` and server entitlements.
- Add only client-side orchestration; no Prisma schema change.
