# LAMTube AI VIDEO — implementation and verification report

Date: 2 October 2026. Repository: `C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1`.

This report concerns the LAMTube implementation and the subsequent request to unify its design. Earlier Resource Intelligence, Exam Ready and other working-tree changes were preserved. No staging, commit, push, deployment, production migration, dependency installation or Android native change was performed.

## 1. Executive summary

Implemented a private, resumable AI visual-lesson pipeline, declarative animated scene player, generation ledger, account library, timestamp-aware tutor, notes and editing controls. Corrected the visual separation identified by the user: AI Video now renders under the existing LAMTube header and ambient background, with matching dark glass, Instrument Serif headings, Inter text, white primary controls and restrained fuchsia accents. The detached blue launch card and duplicate product header were removed.

Local code validation and guest-preview browser checks passed. **Live account generation is not certified:** the configured database was unreachable during the read-only readiness check, and the new migration was deliberately not applied. The silent authored preview is clearly labeled and does not pretend to be an AI-generated or narrated account lesson.

## 2. Existing video architecture discovered

The original `NigtubeView` contains curated YouTube lessons, embedded playback, a Scholar Plus pre-roll state machine, subject filtering, AI study actions, local saved/history state and static curated playlists. There was no existing persistent, seekable narration player or generic account-owned video playlist service. Those curated-video functions remain intact.

## 3. LAMTube rename implementation

Visible navigation, product header, promotion copy, Chapter Command Centre labels, Downloads guidance, Settings copy, Plus comparison copy and LAM action description now say LAMTube. Existing internal `nigtube` identifiers remain where changing them would break compatibility.

## 4. Routes changed

Added `/lamtube` as an accepted application route; normal sidebar navigation now writes that path. Added account APIs: `/api/lamtube`, `/api/lamtube/[id]`, `/api/lamtube/[id]/audio/[clip]`, and the optional authenticated `/api/lamtube/worker`. A lesson is addressable with `/lamtube?aiVideo=<id>`.

## 5. Compatibility behavior

`/nigtube` continues opening the same LAMTube view. Internal navigation and LAM actions still accept `nigtube`. Switching back to curated-video tabs clears the AI lesson parameter and retains the common navigation. Entering AI Video removes the ordinary mini-player and pre-roll rather than leaving iframe audio behind.

## 6. AI Video architecture

An account-owned aggregate stores settings, sources, outline, scene plans, audio clips, assembled timeline, persisted stage, edits and watch state. A bounded request advances one stage or one narration phrase. Private IDs, lease tokens and revision checks prevent concurrent stale workers publishing over newer work. The React workspace is lazy-loaded only when AI Video opens.

## 7. Database/schema changes

Added `AIVideo` and `AIVideoAudio`, their account relation, indexes, ownership constraints and unique request/audio digest keys. Narration uses PostgreSQL byte storage plus existing StoredFile accounting. Parameterized raw queries are used for these new tables so the feature does not require regenerating the currently installed Prisma client just to typecheck. Runtime still requires the migration.

## 8. Generation quota implementation

Extended the existing monthly UsageEvent/UsageCounter ledger with `ai_video_generation`. Capacity includes consumed videos and live reservations. Account/counter locks serialize quota reservations. Readiness and consumption commit in the same transaction; failures and explicit cancellations release outstanding reservations. Resuming refreshes a valid reservation or obtains a new one after expiration. Creation requests are idempotent. Deleting completed work does not refund consumed generation.

## 9. Free vs Plus behavior

Authenticated Free users have 10 full generations per calendar month in their configured timezone; verified Plus/Developer/global-unlock access has no full-generation count cap. Unverified entitlements fail closed to the Free limit. Guests may explore the silent preview but cannot generate or access account videos. Both plans use the same visual engine and settings; storage, abuse controls, existing class policy and provider availability still apply. Playback and small edits do not consume another full generation.

## 10. Generator UI

Integrated AI VIDEO as a first-class tab in the existing LAMTube navigation. Generator, library and player share the same shell and material language. The generator has chapter selection, explanatory guidance, a real confirmation dialog and persisted-stage progress. Failed requests show an error rather than manufacturing completed lessons.

## 11. Basic settings

Lesson title, subject, up to six distinct curriculum chapters, optional topic/doubt, approximate duration and visual style. The server checks class access, subject/chapter membership and canonical chapter titles on creation and draft edits.

## 12. Advanced settings

Six provider-supported English voices, teaching depth, purpose, pace, aspect ratio, additional teaching instructions, default captions, pause-and-check questions, selected resource IDs and explicit source-only teaching. Requested duration is approximate; actual audio duration determines the timeline.

## 13. Generation pipeline

Sources → outline → one scene at a time → one narration phrase at a time → assembly → ready. Each successful step is saved before the next request. Cancellation fences an in-flight worker. Closing the workspace stops client advancement without discarding saved stages. An optional worker endpoint can advance saved jobs; no scheduler was configured or deployed.

## 14. Lesson planning

An ordered outline covers every selected chapter, prerequisites first, followed by intuition, formal explanation, application and recap. The generated outline must contain only selected chapter IDs and cover all of them. Scene prompts include previously taught goals to reduce repetition. This is a structural guard, not a guarantee of perfect factual teaching.

## 15. Scene architecture

Strict Zod schemas validate scene identity, narration phrases, unique element IDs, cue references, bounded geometry, palette, camera and optional question. Text-only/static paragraph slides fail validation. A supported scene must contain explanatory graphics, draw/move behavior and cues across multiple narration phrases.

## 16. Scene primitive library

Labels, short Unicode equations, rectangles, circles, arrows, graphs, polylines/sketches, highlights and brief tables. The renderer accepts declarative data only, not arbitrary JavaScript, HTML, generated SVG code or external asset URLs.

## 17. Narration/TTS implementation

Uses the existing Groq SDK with `canopylabs/orpheus-v1-english`, WAV response format and phrases of at most 200 characters. Actual RIFF/PCM metadata supplies clip duration; malformed, oversized or truncated output cannot publish. Provider bodies are read through a bounded stream. Audio is cached per private video by model/voice/text digest. This follows [Groq's Orpheus documentation](https://console.groq.com/docs/text-to-speech/orpheus). Key presence was checked without printing secrets; account/model access and real speech generation remain unverified.

## 18. Timestamp synchronization

For generated lessons, the native audio element is the master clock. Its clip offset plus accumulated timeline offset drives visuals, captions and tutor context. The explicitly silent preview uses a synthetic demonstration clock. No estimated words-per-minute clock is used for generated narration.

## 19. Timeline engine

One animation loop paints transforms, opacity, drawing progress and camera state. React-facing playback time updates are throttled rather than updated every frame. SVG structure is memoized. Pausing, leaving the page or hiding the document stops the loop; cleanup detaches media listeners and releases the source.

## 20. Deterministic seeking

Scene and clip are located from the absolute timestamp. Every visual cue is reconstructed from that timestamp, independent of previous playback. Backward seeking needs no reversal history. Boundary, invalid-time and random-seek tests pass. In the browser, seeking to 18 seconds through two different paths produced the identical block transform and caption.

## 21. Shared player integration

Both curated and generated experiences retain the common LAMTube navigation, ambient backdrop and design language. Curated videos still use the existing YouTube/pre-roll player. AI lessons use a dedicated native-audio/SVG renderer because the YouTube iframe cannot execute this declarative timeline. No parallel MP4 platform or paid clip-generation engine was added.

## 22. Playback controls

Play/pause, ±10 seconds, timeline seeking, volume, 0.5–2× speed, captions, bookmarks, scene navigation and fullscreen with explicit unsupported-browser feedback. Keyboard shortcuts work when focus is on the player rather than an editable field. Final playback time is explicitly settled at the timeline duration.

## 23. Captions

Captions follow actual narration clip boundaries and can be toggled. A full accessible transcript is also available. This is phrase-level alignment, not forced word-level transcription.

## 24. Chapter markers

Scene markers expose start times and titles, with active state and direct seeking. Each scene retains its selected chapter ID, allowing chapter-aware tutor context and multi-chapter navigation.

## 25. Visual animation system

Deterministic reveal, stroke drawing, motion and restrained pulse cues explain the narrated concept. The authored verification lesson moves a physical block and force arrow, reveals a worked equation and draws two force/acceleration graphs. It is not a collection of generated still frames.

## 26. Equations

Short escaped Unicode equations render as SVG text in lessons. The tutor uses Scholar's existing safe Markdown/math renderer. No model-generated executable markup enters the canvas. Complex typesetting and arbitrary scientific diagram correctness still need live lesson review.

## 27. Diagrams

Diagrams are built from whitelisted geometric elements and cues. Element counts, coordinates, point counts and text lengths are bounded. Rendering remains text/data-only. Model-produced layout quality is not guaranteed by schema validation alone.

## 28. Graphs

Graphs use bounded normalized points within their declared size. Progressive drawing is calculated directly from the narration cue and timestamp. The preview verifies direct proportionality and a second shallower line.

## 29. Handwriting/sketches

Sketch/polyline primitives can draw progressively, supporting whiteboard-like explanation. This is not a handwritten font synthesis or a general handwriting-recognition system; ordinary text remains readable text.

## 30. Camera movement

Optional small bounded pan/zoom, computed from scene-local time. Reduced motion disables camera/pulse motion while preserving readable explanatory states. No planet-travel animation is involved.

## 31. Transitions

Scene-edge opacity is derived from local time, so scrubbing is consistent with playback. Reduced-motion mode removes the animated transition. Controls have lightweight hover/press feedback; no pointer listener per component or shader was added.

## 32. Resource grounding

Reuses Scholar Resource Intelligence retrieval, ownership, rights flags and readable indexed passages. Missing, OCR-pending, link-only or derivative-prohibited sources are rejected for teaching. Strict source-only mode stops before generation if usable selected material is absent. Prompts distinguish grounded claims from general explanation.

## 33. Source citations

Persisted source IDs accompany scenes. Invented citation IDs are rejected. Transcripts expose original HTTPS links or identify private sources without making them public. Public API responses omit raw grounding excerpts and quota reservation keys. Structural citation checks do not prove semantic support of every AI sentence.

## 34. Uploaded material support

Reuses the existing Resource Library import dialog and private PDF/OCR workflow. No duplicate upload/OCR backend was created. Readable, permitted indexed imports may ground lessons. Newly uploaded material may need processing/review before it is selectable; existing link-only catalog entries cannot be silently copied or used as readable excerpts.

## 35. Ask LAM at current moment

The server reconstructs the actual timestamp, current scene, caption, surrounding narration, visible elements and source IDs. Actions include a doubt, simpler explanation, different example, quiz and revision notes. Responses are bounded, cached within the owned lesson and validated for citation IDs. Embedded external media is rejected. Live provider answers were not exercised because account persistence was unavailable.

## 36. Interactive questions

Optional four-choice questions pause at scene completion, show attempt feedback and explanation, then continue into the next scene. These generated checks do not fabricate Scholar XP or official test results. Browser verification confirmed pause near the 28-second boundary, correct-answer feedback and continuation into the graph scene.

## 37. Notes/bookmarks

Account lesson notes, timestamp bookmarks, click-to-seek bookmark chips, favorite state and Markdown export. Watch edits are debounced and pending edits drain after successful writes. Sync errors are explicit; the UI does not claim unsuccessful writes were saved. Preview notes/bookmarks remain demonstration-only rather than account-persisted.

## 38. AI Video library

Owned library with title/chapter search, status filtering, favorites, unfinished work and named private AI collections. Lists the 100 most recently updated lessons and says so in the UI. Pagination beyond that window is not implemented.

## 39. Continue Watching/history

Persisted position and last-watched time support resuming and the AI library's Continue collection. Video/notes responses do not reset the media instance. Existing curated-video history remains intact; it is not silently replaced by account AI history.

## 40. Playlist integration

AI lessons can be assigned to bounded named account-private collections and filtered by collection. The existing curated YouTube playlist tab remains intact. A consolidated mixed curated/AI playlist backend was not already present and is not claimed as implemented; mixed-content management is deferred.

## 41. Editing/regeneration

Rename, favorite, playlist membership, notes and bookmarks do not consume full-generation credit. Duplicate settings creates a draft; its settings can be edited before generation. Voice regeneration reuses scene plans and replaces narration. Full topic/style changes require a new generated draft, counted on readiness.

## 42. Scene-level regeneration

Refine the current scene using an instruction; only that scene and its narration are regenerated. Other narration clips remain cached. A charged lesson is not charged another full-generation credit for scene or voice repair. The previous playable timeline is retained for safe cancellation. Abuse and storage limits still apply.

## 43. Mobile implementation

Shared navigation wraps; generator grids adapt; sidebar tools stack; player controls wrap; scene markers scroll within their own rail. The phone viewport checks at 390×844 and 320×568 showed document widths exactly matching their viewports. No heavy optical filter is applied to the media surface; browser inspection returned `backdrop-filter: none` on the player.

## 44. Android WebView

Uses web-native audio, SVG, touch controls and a fullscreen capability fallback. No Android native files, manifests or APKs were modified or rebuilt. A real Android WebView/device test was not performed; browser viewport checks are not a substitute for it.

## 45. Accessibility

Labeled controls, visible focus states, transcript, narration captions, keyboard shortcuts, semantic library/forms, accessible confirmation dialog and reduced-motion rendering. A full screen-reader certification was not performed.

## 46. Performance

Applied React/persistence guidance by lazy-loading the workspace, using a single timestamp-driven animation loop, memoizing SVG structure and storing bounded resumable work rather than running one oversized request. No glass filters over media, shader mode, frame-by-frame React updates or newly installed animation dependency. Physical low-end devices and long narrated lessons still require profiling.

## 47. Security

Authenticated owned APIs, origin checks, bounded JSON, parameterized SQL, private audio joins, no-store responses, independent stage/tutor limits, existing global AI limits, class checks, per-account storage accounting, lease fencing and strict primitive schemas. Unit tests cover guessed IDs, cross-account/deleted audio, unauthorized access, invalid ranges and quota replay. These use controlled database mocks, not a successful live two-account PostgreSQL penetration test.

## 48. Privacy

Lessons, narration and study state are account-private. No public share endpoint exists. Keys stay server-side; readiness output contained booleans only. Selected teaching passages are sent to the configured AI provider and narration text to Groq; that external processing is inherent to generation. Provider-side retention policies were not audited here.

## 49. Prompt injection defense

Settings, imported passages and student questions are marked untrusted data. Prompts disallow executable code, access changes and invented source claims. Strict scene schemas cannot express arbitrary scripts, HTML or external media. Tutor media embedding and unsupported citation IDs are rejected. These safeguards reduce risk but do not guarantee perfect semantic grounding or immunity to all prompt attacks.

## 50. Files changed

New feature files:

- `src/lib/lamtube/{access,actions,client,generate,http,model,narration,preview,settings,store,timeline,wav}.ts`
- `src/components/lamtube/{workspace,player,scene-canvas,video-detail}.tsx`
- `src/components/lamtube/lamtube.css`
- `src/app/api/lamtube/route.ts`
- `src/app/api/lamtube/[id]/route.ts`
- `src/app/api/lamtube/[id]/audio/[clip]/route.ts`
- `src/app/api/lamtube/worker/route.ts`
- `src/lib/ai/structured.ts` — extracted existing structured-provider policy for reuse
- `tests/lamtube-timeline.test.tsx`, `tests/lamtube-quota.test.ts`, `tests/lamtube-pipeline.test.ts`, `tests/lamtube-security.test.ts`
- `scripts/lamtube-readiness.ts` — read-only, secret-safe readiness check
- This report and the migration listed below

Existing files changed for this feature:

- `prisma/schema.prisma`
- `src/lib/subscriptions/monthly-usage.ts`
- `src/lib/exam-ready/teacher.ts` — import/re-export of the extracted provider helper; existing teaching logic preserved
- `src/components/views/nigtube.tsx`
- `src/components/app-shell.tsx`, `src/lib/nav.ts`, `src/lib/routes.ts`
- `src/components/subscriptions/free-ad-slot.tsx`, `src/components/subscriptions/nigtube-plus-ad.tsx`
- `src/components/views/chapter-command.tsx`, `src/components/views/settings.tsx`, `src/components/views/downloads.tsx`, `src/components/views/scholar-plus.tsx` — visible video branding only
- `src/lib/v2/lam/action-framework.ts` — visible description only

The full working-tree diff also contains older tasks. Its total is not attributed to LAMTube. A temporary feature-only formatter was removed after use; no project or user content was deleted by that cleanup.

## 51. Migrations created

`prisma/migrations/20261002180000_lamtube_ai_video/migration.sql`. Created, **not applied**. It depends on the existing PostgreSQL User table and the existing usage/storage infrastructure. No destructive reset or schema push was run.

## 52. Environment variables

Existing database configuration (`DB_DATABASE_URL`, direct/unpooled URL), existing Scholar lesson-AI configuration and `GROQ_TTS_API_KEY` with `GROQ_API_KEY` fallback. Optional `LAMTUBE_WORKER_SECRET` protects worker advancement. No environment file or secret value was changed. Initial Prisma CLI validation lacked the direct URL in its process environment; syntax validation subsequently passed with explicit dummy local URLs, without contacting a database.

## 53. External services required

Reachable migrated PostgreSQL, the configured Scholar structured AI provider and Groq Orpheus speech access. An external scheduler is optional for autonomous background advancement. No image/video clip generation subscription, new CDN or MP4 rendering service was installed.

## 54. Tests run and exact results

LAMTube tests were run in separate Bun processes to isolate module mocks:

| File | Passed | Failed |
| --- | ---: | ---: |
| `tests/lamtube-timeline.test.tsx` | 29 | 0 |
| `tests/lamtube-quota.test.ts` | 9 | 0 |
| `tests/lamtube-pipeline.test.ts` | 7 | 0 |
| `tests/lamtube-security.test.ts` | 10 | 0 |

Focused shared regressions: `exam-ready-teacher.test.ts`, `exam-ready-access.test.ts`, `resource-engine.test.ts`, `subscription-security.test.ts`: **54 passed, 0 failed**. Total focused assertions grouped as tests: **109 passed, 0 failed**. Early failures in the reduced-motion zero value and scene-repair fixture were resolved and rerun; only final passing results are listed above. No full platform test suite was rerun.

`git diff --check`: exit 0. Windows LF/CRLF notices were warnings, not whitespace failures. Prisma schema syntax: passed using dummy environment URLs; no database/migration validation is implied.

## 55. TypeScript result

Final `bunx tsc --noEmit`: exit 0. The production build's TypeScript phase also passed. Initial integration errors were corrected before final validation.

## 56. Lint result

Focused ESLint over all LAMTube files, tests, readiness script and modified shared/UI files: exit 0, no warnings or errors. Full repository lint was not run.

## 57. Production build result

Final `bun run build`: exit 0 on Next.js 16.3.6. Compilation, TypeScript, page collection and all 55 generated static pages completed. The route manifest includes all four new LAMTube APIs. Build success does not prove database access or provider generation.

## 58. Browser tests

Agent-browser CLI was unavailable. A standalone Playwright/installed-Chrome launch timed out with updater access errors; no permission bypass or browser installation was attempted. Browser verification then used the supported Codex in-app browser in a temporary background tab, preserving the user's tabs and restoring viewport settings afterwards.

Verified shared header, integrated AI tab, generator/advanced controls, authored preview, 18-second deterministic seek, caption/context, bookmarks, speed selection, pause-and-check feedback, continuation, guest library message, mobile layout and the `/nigtube` compatibility route. Captured error logs for the QA tab were empty. This was scripted/manual browser verification, not a completed Playwright test suite or live-provider end-to-end run.

## 59. Visual QA

Viewed desktop generator/player screenshots and mobile screenshots. AI tools now keep the same LAMTube identity and surrounding navigation instead of switching to an unrelated blue product. Verified 390px and 320px document widths, and checked that the player has no backdrop filter. The silent demo was used for visual verification, never substituted for a real generated lesson.

## 60. Known limitations

The database was unreachable in the read-only readiness check; migration presence was unverified. Actual account creation/generation, real TTS, cross-device saves and live two-account ownership must be verified once a permitted migrated database is available. Provider credentials being present does not certify model access. No autonomous worker is configured. Library pagination beyond 100, mixed curated/AI playlists, word-level alignment, complex notation and real-device audio buffering/performance are not certified. AI factual accuracy and citation semantics need human review of real generated lessons.

## 61. Deferred work

After database readiness: live two-account and quota-race testing, a complete narrated generation/playback/regeneration journey, Android WebView checks and low-end performance profiling. Optional durable scheduler, older-library pagination, unified mixed-media playlists and future timeline-to-MP4 export. No paid clip generator or public sharing was added. These items are not represented by fake completed UI states.

## 62. Recommended deployment steps

With explicit deployment/migration authorization: verify a staging database and required preceding migrations; apply the new migration there; verify lesson AI and Orpheus access; exercise Free/Plus accounts and owner isolation with real persisted audio; check cancellation/retries/deletion and storage/quota accounting; test physical devices; optionally configure a protected bounded worker scheduler; then review and deploy. No step in this deployment checklist was performed automatically. The local development server remains available at `http://localhost:3000/lamtube`.
