# Scholar: The Living Homepage — implementation and verification

Date: October 20, 2026 (Asia/Calcutta). Branch: `sepb-rc`, based on `a33071f`.

## A. What was implemented

The public homepage now continues from the original Scholar hero and real account form into ten distinct, interactive product showcases, a final account/Guest invitation, and the existing footer. This is functioning responsive React UI, not a stack of concept screenshots.

The original hero headline, remote ambient clip, account creation, Guest action, and Group Study entry remain. Header feature labels now navigate to actual sections. Sign in remains available in the fixed header. `/login` renders the account form immediately without the marketing journey, including recovery and verification entry states.

The new demonstrations are deliberately scripted, Scholar-authored public samples. They do not call LAM providers, create preparations, upload documents, send room messages, or write student records. Sample scope and access restrictions appear in the interface. Study Music remains paused, as it is in the actual app; the showcase instead offers a functional local timer and links to the existing Focus space and music notice.

## B. Design architecture

`AuthScreen` retains authentication state, submission, Google availability gating, token handling, notices, password visibility, and Guest entry. It imports `LivingHomepage` asynchronously. The dedicated login route passes `accountOnly`.

`LivingHomepage` composes feature modules rather than extending the auth component. Shared `ShowcaseSection`, `GlassPanel`, `PreviewLabel`, `FeatureLink`, and `OrbitalArt` primitives provide semantic section landmarks, scoped material styling, and consistent navigation. The knowledge and intelligence modules have their own scoped layout styles.

The visual system combines warm ivory editorial headings, bronze edge lighting, translucent layered surfaces, restrained violet undertones, original CSS orbital forms, and a warmer paper surface in the reader. It reuses the existing Instrument Serif font variable and existing Barlow direction. The established Aurora artwork is unchanged. It does not adopt the classical bust in the concepts as LAM.

The compositions vary: a three-card ecosystem, a broad classroom with companion tools, a centered preparation workspace with side panels, three material previews, a subject/chapter journey, a question with supporting explanations, an agenda/calendar, a shared study room, a paper-and-annotations reader, and a timer/atmosphere arrangement.

## C. Ten-reference implementation matrix

All ten supplied images were considered by their contents. The correspondence below uses filename prefixes to distinguish attachment ordering from the conceptual order in the brief.

| Supplied concept / attachment | Implemented section and main visual | Working interactions | Media / fallback | Fidelity and limitation |
|---|---|---|---|---|
| Scholar Experience — `22c68431…` | `#experience`: AI tutors, Smart notes, Mastery tracking in three glass cards | Note/summary switch; real tutor, notes, analytics links | Existing Aurora WebP; authored note; CSS orbital illustration | Preserves three-part hierarchy and editorial/glass treatment. Does not reproduce the generated bust or claim sample topic states as real mastery. |
| Meet LAM — `a1e20f30…` | `#meet-lam`: dominant classroom, Aurora, lesson board, notes, formula, clarification | Concept → worked example → question; wrong/correct feedback; friction clarification | Existing Aurora; HTML force diagram and formulas | Preserves broad classroom/supporting-tool composition. Explicit scripted sample, not live AI or a new lesson recording. |
| Exam Ready — `facb5564…` | `#exam-ready`: dominant preparation workspace, priority chapters, recall and repair panels | Plan/Recall/Repair selection; reveal and navigate cards; check misconception, retry | HTML/SVG-free UI and CSS orbital decoration | Preserves central planning/side-panel story. Uses a labeled 60-minute allocation rather than invented readiness scores or guaranteed results. |
| Materials & Sources — `f6233a2f…` | `#materials`: paper reader, scan/extraction comparison, resource finder | Toggle extraction; search/filter materials; select resource | Original Scholar text, original inline leaf SVG | Preserves three rich preview zones. Extraction is illustrative and explicitly needs review; external references are not called indexed teaching content. |
| Group Study — `1b946849…` | `#group-study`: common problem, force diagram, discussion/notes/resources workspace | Add a local message; edit sample notes; switch views; reveal reasoning | Original question/diagram; illustrative initials | Preserves dominant room composition and collaborative context. No real network presence, shared editor session, or message transmission; Beta/Plus-hosting restrictions are stated. |
| Chapter Command — `7172580a…` | `#chapters`: subject navigation, connected chapter nodes, selected details | Physics/Mathematics and chapter selection update concept, tags, formula | CSS orbital detail; original sample data | Preserves navigation/journey/detail hierarchy. No fake locked progression or mastery records; selections do not alter a profile. |
| Practice & Mocks — `111f4754…` | `#practice`: question/options, feedback, mistake reasoning, actual practice/mock links | Select/check; retry; change question; accurate explanation | Two original kinematics examples | Preserves assessment and improvement story. No invented NEET coverage, fake countdown, simulated scoring service, or mutation of a real mock. |
| Planner & Today — `37f86941…` | `#planner`: colored study blocks, day selector, matching agenda, activity detail | Choose day/activity; mark/undo sample completion | Original October 2026 schedule; CSS orbital detail | Preserves calendar/agenda relationship. No fake streak, notifications, or completion written to an account. |
| E-books & Reading — `f47ee854…` | `#reading`: warm reading page, annotations, book tools and pagination | Highlight/remove, bookmark/jump, read three pages, keep a local note | Original Scholar reading text | Preserves the quieter typography and paper/annotation relationship. No private book content; notes are explicitly preview-only. |
| Focus modes — `2fe88b46…` | `#focus-modes`: real timer, artwork/availability card, visual themes | 25/50/90-minute timer, start/pause/reset, theme selection; real Focus/music-notice links | CSS concept artwork; silent visual themes | Preserves relaxing atmosphere and timer/artwork composition. Actual Study Music is paused; no fake audio playback, playlist availability, or concentration statistics. |

These are composition-led interpretations, not pixel-identical copies of the generated scenery. No new photorealistic terrain, cinematic recordings, or audio recordings were created. Interactive UI, original diagrams, and existing approved artwork are the intentional alternatives.

## D. Files changed

Modified:

- `src/components/auth-screen.tsx`
- `src/app/login/page.tsx`
- `src/components/ready-background-video.tsx` — optional `paused` presentation prop; defaults preserve other callers
- `tests/public-auth.spec.ts` — intentional layout expectations updated; behavioral auth checks retained

Added:

- `src/components/landing/living-homepage.tsx`
- `src/components/landing/primitives.tsx`
- `src/components/landing/core-sections.tsx`
- `src/components/landing/demo-data.ts`
- `src/components/landing/intelligence-sections.tsx`
- `src/components/landing/knowledge-sections.tsx`
- `src/components/landing/landing.module.css`
- `src/components/landing/intelligence.module.css`
- `src/components/landing/knowledge.module.css`
- `src/components/landing/auth-integration.css`
- `tests/cinematic-homepage.test.tsx`
- This report.

Generated browser evidence is stored under `test-artifacts/cinematic-homepage/`. No package, lockfile, database schema, migration, provider configuration, or public artwork asset changes were made for this task.

## E. Motion, responsiveness, and accessibility

Two IntersectionObservers handle entrance reveals and section presence. They update DOM presentation attributes rather than React state on every scroll or pointer frame. Native scrolling is preserved. Orbital lighting is restrained and runs only while its section is near view; document visibility and the ambient-motion control pause it. Reduced motion disables the new entrance/ambient animations and native smooth anchor scrolling.

The hero retains the existing visibility-aware background helper and its poster fallback, with an explicit pause/resume action. No narration or music autoplays. There is only one ambient video element on the public page, compared with two before this change. The ten new sections add no video, audio, or iframe surfaces.

The timer uses an elapsed-time deadline and only runs its interval after an explicit Start action. Pausing ambience does not freeze controls or newly revealed content. A review found and fixed that potential animation bug before final verification.

Desktop compositions collapse into readable layouts rather than miniature screenshots. Mobile reader annotations sit beneath the page, the classroom becomes a vertical lesson, the agenda follows the schedule, and secondary panels stack. Small-screen buttons have at least 44-pixel minimum dimensions, and editable sample fields use a 16-pixel font. Controls have accessible names, visible keyboard focus, pressed/expanded state where appropriate, and status feedback. Decorative orbital art is hidden from assistive technology. Dedicated account entry has its own `h1`.

Production geometry checks passed at 320×720, 375×812, 390×844, 768×1024, 1024×768, 1366×768, 1440×900, 1920×1080, and 844×390. At every size: document scroll width equaled client width and no showcase button/input/textarea extended outside the horizontal viewport. Real screenshots were inspected for all ten desktop sections and representative small-screen hero, classroom, materials, reader, focus, and account layouts.

## F. Measured performance and media costs

Final build ID: `TO-8bK3Vy_7Tk77BqYKJe`.

| Emitted landing async group | Raw bytes | gzip level 9 bytes |
|---|---:|---:|
| `03vya-8i4e0tw.js` | 77,147 | 19,069 |
| `3ax-77eme9xgk.js` shared icons | 2,948 | 1,112 |
| `2yrb81i974zgn.css` | 86,440 | 15,330 |
| Total | 166,535 | 35,511 |

The primary async group is approximately 34.68 KiB gzip; its JS subtotal is 20,181 bytes gzip. An alternate entry groups more shared code into `41_ximo90y-z8.js`, producing a 42,549-byte gzip group. These are measured emitted-file compression sizes, not total-page transfer deltas. The sections share one asynchronous import; this is code splitting, not per-section viewport loading. Their actual raster media uses lazy Next Image loading with fixed dimensions. The existing Aurora source is 90,912 bytes; the existing SVG background poster is 1,890 bytes. No dependencies or new large raster/video assets were added.

One local production-browser observation recorded DOMContentLoaded at 254.1 ms, load at 348.3 ms, FCP at 740 ms, and a buffered largest-contentful-paint entry at 740 ms. The six recorded non-input layout-shift values summed to approximately 0.00932. Six buffered startup long tasks were observed; the longest was 259 ms. The capture began with the hero poster in a background-created tab, and some static resources were cached. It is not a cold mobile-network result or a guarantee about CDN video startup.

No comparable pre-change cold-load baseline was recorded, so no improvement percentage is claimed. No Lighthouse score, physical Android benchmark, CPU-throttled smoothness score, or comprehensive memory-leak result is claimed. The existing shared app startup still merits future profiling; the 259 ms task prevents a truthful claim of universally zero jank. Browser interactions exercised here did not visibly stall.

Network recording during material search, chapter switching, practice feedback, planner completion, local room interactions, reader annotations, and timer/theme actions recorded **zero requests**, including zero API/provider requests. Evidence: `demo-network-check.json`.

## G. Exact verification results

| Check | Result |
|---|---|
| `bunx tsc --noEmit --incremental false` | Passed |
| `bun run lint` | Passed |
| `bun run build` | Passed; compile, TypeScript, and 70/70 static pages completed |
| `bun test tests/cinematic-homepage.test.tsx tests/section-shutdown.test.tsx` | 16 passed, 0 failed, 186 assertions |
| Established isolated unit runner | 111 files; **1,223 passed, 0 failed, 16 skipped**; no unsuccessful files |
| `git diff --check` | Passed |
| Actual browser | Development and final local production build inspected; nine viewport geometries passed |

The first build exposed an ES2018-only regular-expression flag in the new test while the project targets ES2017. The expression was corrected, and the final TypeScript/build checks passed. A combined invocation of existing auth suites initially leaked shared Bun mocks between files; the repository's established process-isolation runner then passed all suites, including recovery and Google identity tests. Tests were not weakened to conceal these failures. A CSS-module name that collided with a String method in Bun's unbundled renderer was renamed, removing the test warning without altering browser behavior.

The updated Playwright `public-auth.spec.ts` was not executed as a separate Playwright-runner session; real UI checks were performed with the browser tools. Its existing behavior assertions remain in place for the normal browser-test workflow.

### Browser interactions actually exercised

- Public root renders the original hero and ten section landmarks.
- Header anchor navigation and Get Started work; signup heading was at 127.7 px in the measured desktop viewport.
- Signup/login switching, password visibility, recovery entry, and keyboard focus work.
- `/login` immediately presents the form without a hero/showcase; desktop `h1` top was 137 px.
- Invalid recovery token shows a focused error, opens the reset form immediately, and removes the fragment from the URL without consuming a token.
- Local Google button remains correctly disabled when configuration is unavailable.
- Guest entry reaches the existing dashboard; the genuine `/exam-prep` route renders with the existing Guest/live-AI restrictions intact.
- LAM sample changes from concept to worked example to check; both wrong and correct answers produce the expected net-force explanation.
- Exam Ready recall reveals the zero-net-force explanation; its repair view diagnoses confusing velocity with acceleration.
- Material search for “cell” narrows to the matching source; extraction content remains visible in reduced motion.
- Mathematics/chapter selection changes the detail to trigonometric functions and `sin²θ + cos²θ = 1`.
- Practice diagnoses using final velocity instead of change in velocity; the correct result is `4 m/s²`.
- Planner changes to Tuesday and marks/undoes sample completion locally.
- Study-room message and note editing stay in the local preview.
- Reader page navigation, bookmarks, and a kept sample note work.
- Timer changes to 50 minutes, advances to 49:20, pauses, and keeps the selected silent Rain theme.
- Hero pause/resume controls and the production poster fallback remain usable.
- No warning/error console entries were returned for the final production tab at the check.

## H. Actual browser screenshots

All ten full desktop sections were saved as `production-desktop-<section-id>.jpg`. The screenshots below show the actual built UI. They preserve the references' editorial hierarchy, warm glass, broad classroom/paper compositions, and supporting panels while replacing speculative metrics and recordings with working, labeled UI samples.

Desktop classroom:

![Built desktop LAM showcase](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/test-artifacts/cinematic-homepage/production-desktop-meet-lam.jpg)

Mobile classroom:

![Built mobile LAM showcase](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/test-artifacts/cinematic-homepage/production-mobile-meet-lam.jpg)

Mobile reader:

![Built mobile reader](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/test-artifacts/cinematic-homepage/production-mobile-reading.jpg)

CTA/footer continuity:

![Built final invitation and preserved footer](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/test-artifacts/cinematic-homepage/production-cta-footer.jpg)

Additional evidence includes the 320-pixel hero, immediate login, all ten desktop compositions, timer state, responsive JSON, full unit results, and production performance observations in the same artifact directory.

## I. Remaining limitations and unverified work

There are no known failing build/unit checks or horizontal-overflow issues from this implementation. The visual interpretation deliberately uses CSS/SVG art and existing Aurora rather than reproducing the references' generated photorealistic environment. New product-demo recordings and licensed music previews are not available; the page makes no claim to play them.

Real successful email signup/login, Google OAuth, delivered recovery/verification mail, and authenticated private-feature journeys were not performed with real accounts in this task. Their UI and existing isolated server/security regressions were checked. Google is unconfigured on the tested local instance. No production/staging access or account creation was needed for this public frontend work.

The original remote hero clip remains CDN-dependent. The existing poster fallback is verified, and the existing clip was visible during development inspection; full cold-network remote-video reliability is not certified here. Generated marketing samples are not evidence that the underlying academic library or wider beta release is complete.

## J. Repository and environment safety

No commit, staging operation, push, merge, deployment, migration, database reset, production change, credential change, provider configuration change, billable AI request, or new account creation occurred for this homepage task. The earlier `a33071f` push predates it. Existing unrelated untracked projects, APKs, and historical test artifacts were preserved.

The final built preview is served locally at `http://127.0.0.1:3004/`. Development remains available at port 3002. Browser viewport/media emulation used for verification is temporary and restored before handoff.
