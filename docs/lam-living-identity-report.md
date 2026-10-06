# LAM Living Identity 2.0 — local implementation and verification

Date: 6 October 2026. Verification was performed locally before the user's subsequent request to publish the accumulated changes. Historical no-push/deployment notes describe that verification stage. This is a behavior-and-motion implementation, not a claim that flattened concept art has become a fully articulated character rig.

## 1. Existing implementation audit

The existing registry, 22 approved forms, two reference sheets, account-local appearance preferences, shared avatar, rollout flag, gallery, presence runtime and contextual placements were retained. Earlier animation used a small set of general loops. Contextual activity already existed but lacked coordinated finite feedback and a complete atomic LAMTube story.

## 2. What was retained

Original reference artwork and crop coordinates, identity IDs, canonical Aurora, fallback mark, account isolation, source attribution, current product layouts, LAM opening/closing transitions, voice onboarding and provider routing. No unrelated section was redesigned. Entitlements, YouTube playback and uploaded-book processing were not bypassed or replaced.

## 3. What was improved

Shared priorities, focus targets, transient feedback, inactivity, contextual posture, avatar-specific motion profiles, session restraint, gallery previews, interruption-safe peeks and LAMTube storytelling. Existing Settings update logs describe the changes, including smaller mobile, visibility and motion-control fixes.

## 4. Central behavior architecture

`src/lib/lam/presence.ts` holds ephemeral presentation state. Components register and release owned activities through `useLamActivity`. One AppShell runtime owns session input listeners and a five-second clock; one boundary timeout coordinates short reactions. No avatar choice or animation changes model behavior, academic results, or AI prompts.

## 5. Animation state system

52 states cover idle, attention, input, thinking, processing, reading, teaching, feedback, focus, review, sleep/wake, music, peeks and LAMTube phases. Posture and secondary motion use separate layers. Scene props are small, decorative and do not replace actual status, text, error messages or progress.

## 6. State priority system

Error/caution outrank teaching/responding, thinking/reading/processing, listening, focus, finite encouragement and ambient motion. Busy work or new listening/teaching/error activity cancels ambient stories. Success/error flags settle instead of restarting a celebration on every render.

## 7. Avatar-specific motion system

All 22 forms have bounded individual profiles, grouped into ten motion languages: cosmic, mechanical, soft, guardian, crystal, ribbon, scholar, owl, lantern and book. Grounded forms may have zero vertical float. There is no face stretching, replacement eye drawing or source-art recoloring.

## 8. Top-bar changes

Small shared-state avatar, restrained idle and hover response. Cursor awareness is scoped to the Ask LAM capsule, mouse-only on desktop, throttled to ten CSS writes per second and capped at tiny offsets. It does not track or store global cursor movement.

## 9. Ask LAM changes

Typing and microphone listening, request processing, source reading, answers, speech and error states drive the same controller. A compact persistent scene is separate from real progress/messages. Opening, closing, keyboard access and existing contextual chips remain.

## 10. LAM AI changes

Live tutor has a persistent compact scene during conversation and a larger empty-state scene. Actual stream, speech, tools, draft and error signals drive it. Historic turn icons stay static. No provider or voice pipeline was changed in this polish pass; authenticated streaming was not re-exercised during this guest visual QA.

## 11. Chapter Command Centre changes

Chapter tutor receives listening/thinking/teaching/error states and input/content/formula targets. Practice maps real revealed answers to finite happy/helpful feedback, then settles. The existing chapter learning route, resource navigation and generated prompts remain unchanged.

## 12. Exam Ready changes

Teacher, practice and review states come from actual task and answer state. Guest demonstration feedback animates without claiming verified readiness. Setup/overview/final-review visuals use their appropriate context. The shared clock derives focused/urgent/emergency restraint from the real exam deadline; emergency motion is static and peeks remain suppressed.

## 13. LAMTube signature interaction

Central atomic story: notice at 0 ms, look-back at 260, eye contact at 1020, shrug at 1500, “What?” at 2120, return at 2580, watching again at 3360. Repeated clicks cannot restart it; cooldown is 12 seconds. Rare short double-take/wave alternates also return. Hidden/reduced/muted/unmounted contexts cancel safely. This expresses the sequence through whole-art posture and a small computer/bubble, not genuinely rigged back-turns or articulated shoulders.

## 14. Study Music integration

Small optional desktop companion follows actual playback as listening_music/rest. Mobile clutter is avoided. Existing Plus gate, music-first interface, source player, queue and compliant media architecture remain unchanged. Authenticated Plus playback was not exercised in this guest QA.

## 15. E-Book / Resource contextual states

Built-in and uploaded readers register reading/scanning/error states. Uploaded-reader OCR and study-generation activity is also connected. These are presentation hooks only: no book extraction, API behavior, ownership or page-text access changed in this task. Private uploaded PDFs were not browser-tested in the guest workspace.

## 16. Ambient peek system

Rare left/right appearances choose a real clear desktop margin using hit testing. Variants look, shyly retreat or wave. Peeks never take focus automatically and clicking opens the existing shared LAM panel. No separate chat is created.

## 17. Peek rules / cooldowns

Five minutes between peeks, at least twenty seconds of quiet, minimum 1100 × 650 viewport. Balanced maximum three per session; lively four; quiet zero. Allowed calm browsing pages are restricted. Typing, dialogs, reading, assessments, urgent exams, busy work, fullscreen, hidden tabs and reduced motion suppress them. A development-only preview obeys collision and context rules.

## 18. Session continuity

Greeting occurs once per mounted Scholar session. Route changes retain interaction history, peek count and cooldown. Explicit session mute is ephemeral. Appearance remains in the existing account-local workspace; cross-device appearance sync is not introduced.

## 19. Idle / sleep / wake system

Quiet idle becomes rest after 90 seconds, sleepy after four minutes and sleeping after eight. Focused/busy owners do not fall asleep. Real interaction wakes an inactive avatar with finite feedback. Idle reactions can be disabled.

## 20. Settings improvements

All 22 forms remain selectable. Nine live preview states, preview-versus-apply separation, quiet/balanced/lively presence, cursor awareness, motion intensity, reduced character motion, ambient/peek/celebration/idle switches and session quiet. Preview art loads eagerly; static gallery cards remain lazy and unanimated.

## 21. Canonical / default handling

Aurora remains the canonical default. Corrupt/legacy preferences normalize through the allowlisted existing schema. Selecting a different form changes appearance only, never intelligence or teaching personality.

## 22. Reduced motion

Scholar accessibility settings, character preference, battery mode and OS reduced motion make character motion static. CSS independently disables animations, transitions and pseudo-element motion for OS reduction. Session quiet and animation-off controls are respected. Hidden and offscreen characters pause; the shared observer disconnects when unused.

## 23. Accessibility

Decorative scenes, artwork and captions are aria-hidden; actual assistant status/error text remains separate. Interactive controls retain names, keyboard operation and selected states. Peeks do not steal focus. Existing onboarding and microphone permission behavior remains intact; no microphone permission was requested during QA.

## 24. Mobile

320 × 700 and 390 × 844 galleries visually checked with no horizontal overflow (document width equals viewport width). Preview centers at 112 px, controls wrap and cards form two columns. No ambient edge peeks or desktop cursor tracking. Existing Mobile LAM mode remains authoritative; the guest workspace default is Off. This is responsive-browser evidence, not a physical-device certification.

## 25. Android WebView

No APK changes or device deployment. Small-screen exclusions, visibility cleanup and reduced-motion fallbacks are shared with the web implementation. Actual Android WebView hardware testing remains unperformed and is not claimed.

## 26. Performance optimizations

No React state updates for cursor samples, no per-character animation clock, no animated history/card grid, one shared IntersectionObserver and deduplicated external-store notifications. Immutable per-owner states ensure feedback settles even while another activity holds the global priority. Motion uses bounded transform/opacity rather than a canvas or heavy 3D dependency. Navigation, scrolling and typing were exercised qualitatively; no FPS, CPU, battery or authenticated-stream latency benchmark is claimed.

## 27. Reference fidelity validation

Both source sheets remain byte-identical to supplied originals (covered by tests). Browser inspection visited every form in idle, thinking and teaching: 66 preview samples across 22 IDs. Original faces, silhouettes, clothing and palette are preserved. These flattened single-pose images cannot faithfully perform the storyboard’s eye blinks, mouth expression changes, arms pointing, or true three-dimensional turns. Exact articulated animation is not complete and needs authored layered/sprite/3D rigs for all forms.

## 28. Files changed

Living core: `src/lib/lam/{identity,presence,visibility}.ts`; `src/components/lam/{lam-avatar,lam-scene,lam-presence-runtime,lamtube-companion,lam-identity-settings,use-lam-cursor}.tsx` (cursor file is `.ts`), `lam-identity.module.css`.

Context integration: `src/components/lam-widget.tsx`, `chapter-command/workspace.tsx`, `ebook/uploaded-book-reader.tsx`, `views/{ebook,live-tutor,music,settings}.tsx`, `exam-ready/{workspace,teacher-panel,presentation,overview,setup,final-review}.tsx`. Existing AppShell, LamMark, registry/flag/store integration and reference assets belong to the retained earlier identity work. New test and this report were added; unrelated dirty files were preserved.

## 29. Tests added

`tests/lam-living-behavior.test.ts`: 18 tests for all-form motion bounds, safe preferences, priorities, finite feedback, deduplicated subscriptions, deadline urgency, session continuity, rest/sleep, LAMTube atomic phases/interruptions/alternates, and peek limits/context exclusions.

## 30. Exact test results

Focused command: `bun test tests/lam-living-behavior.test.ts tests/lam-identity.test.ts tests/account-workspace.test.ts`: **36 passed, 0 failed, 529 expectations**, three files.

Repository `.test.ts` files run in separate Bun processes after the final owner-subscription regression fix: **775 passed, 3 failed, 13 skipped across 75 files**. 74 file processes exited successfully. The failures are existing `personalization-security.test.ts` PDF tests: queued background-task count, durable-storage failure status (expects 422, receives 503), and stored original upload (expects 201, receives 503). No animation-task changes were made to that test or its upload API. Live-provider tests account for the 13 skips. Multi-file broad batches leaked existing module mocks into other tests and were stopped; the isolated run is the reported result.

## 31. TypeScript result

Standalone TypeScript check passed; final production build’s TypeScript phase also passed.

## 32. Lint result

`bun run lint` exited 0 after final code changes. React checks informed shared listeners, primitive dependencies, ref-based cursor sampling and animation wrappers.

## 33. Build result

Final `bun run build` exited 0: compilation 9.9 seconds, TypeScript 34.2 seconds, 66 static pages generated. `git diff --check` exited 0 (only working-copy LF/CRLF notices). No dependencies installed for this motion work.

## 34. Browser QA

Agent-created isolated local guest tab only; user production tabs untouched. Development port 3001 and compiled production port 3002 tested. Gallery 22-form matrix, preview/application separation, motion-off (zero character animations), session quiet, reduced-character motion, OS reduced-motion initial load (static, zero animations), 320/390 px mobile gallery layouts, offscreen pause, chapter typing targets, shared Ask LAM onboarding/input/closing and LAMTube timed return checked. A local Laws of Motion guest plan was built; correct and incorrect diagnostic choices produced happy/helpful reactions without changing recorded readiness. Browser QA caught and prompted a fix for lesson-owner feedback failing to settle; the regression is covered by the new test and a compiled-browser recheck: both the header and exam placement settled to attentive, with matching question targets. The local test plan timer was paused afterward.

The final-build test server was restarted after compilation. A development HMR session produced missing CSS-link chunk warnings; compiled routes were checked separately rather than treating stale hot-reload output as production evidence. Local DB overrides are unavailable because the existing local database URL is not PostgreSQL-compatible; live account/Plus/provider flows were not bypassed or certified. Screenshot evidence is in `test-artifacts/lam-living-*.png`.

## 35. Known limitations

Articulated reference-perfect acting is incomplete, as explained in section 27. Live AI, authenticated Plus Music, private-reader activity, real microphone/speech playback and Android hardware require their respective environments. Browser qualitative checks are not exhaustive performance metrics. Existing PDF-security test failures and local DB configuration are separate unresolved issues. No production deployment was made.

## 36. Deferred post-beta ideas

Commission faithful layered rigs or sprite sequences for every approved form, then add true gaze/eyelid/mouth/limb motion without changing identity. Add physical-device/WebView and low-end performance runs, authenticated end-to-end streaming/reader/music checks, an automatic animation screenshot matrix, and explicit cross-device appearance sync only with its own data contract.
