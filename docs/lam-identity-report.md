# LAM identity — local implementation report

October 5, 2026. Verification was performed locally before publication. The user subsequently requested publishing the accumulated changes on October 6; historical local-review notes below describe the original verification stage, not current Git or deployment status.

## 1. Executive summary

LAM now has a shared, selectable visual identity using all 22 forms from the two supplied reference sheets. Settings previews are separate from applying a choice. The same choice appears in the top Ask LAM capsule, expanded assistant, LAM AI, Chapter Command Centre, Exam Ready and LAMTube. Motion reflects existing activity rather than calling an AI model. Existing Scholar layouts, permissions, providers and teaching personalities remain intact.

## 2. Existing architecture discovered

Scholar already has Zustand settings, isolated Guest/account-local workspaces, LAM conversation storage, a stateful top assistant, dedicated live tutor, chapter tutor, Exam Ready teacher and a shared feature-flag service. The assistant already supplies listening, transcribing, thinking, speech, action, completion and error states. Its opening/closing transitions were preserved. Account appearance settings do not currently have a cloud-sync endpoint.

## 3. Reference assets used

The supplied `895a89c5…` concept sheet and `727a05a2…` mascot sheet are copied byte-for-byte to `public/lam/identity/concepts.png` and `mascots.png`. CSS crop windows exclude reference captions and card borders. No generated replacements, stock faces or generic robot redraws were introduced.

## 4. Avatars implemented

Aurora, Nexus, Orbit, Lume, Arc, Prism · Faceted, Kindle, Cosmos, Study Buddy, Icon, Orb, Glyph, Guide, Owl, Prism · Crystal, Ribbon, Atlas, Lantern, Halo, Lore, Nova and Wisp. The two different Prism illustrations have separate stable IDs. Aurora is the configurable default.

## 5. Fidelity and unavailable poses

All 22 original illustrations are available. However, the references provide **one raster pose per character, not separate limbs, eyelids or a 3D rig**. Therefore blinking uses a restrained light/glimmer equivalent; looking back and shrugging use whole-character turns and a small lift. These are not claimed as genuine articulated face/arm animation. Artwork, proportions, eyes, materials and silhouettes are retained without mesh distortion. Dedicated turn-around poses would require approved layered/sprite assets.

## 6. Registry

`src/lib/lam/identity.ts` centrally defines IDs, names, descriptions, assets, thumbnails, dimensions, crops, signature family, accent, default scale/position, supported states/placements and fallback. Unknown IDs normalize to Aurora; arbitrary asset URLs are rejected.

## 7. Animation architecture

`LamAvatar` is the single renderer. Scoped CSS uses transform and opacity, not canvas, WebGL or animation-frame loops. `presence.ts` is an ephemeral external store with owner registration, priority arbitration and release on unmount. A single shell runtime handles reduced-motion/visibility signals and the rare ambient scheduler. No chat text is stored in presence state.

## 8. Core states

The registry includes idle, blink, hover, greeting, listening, thinking, responding, teaching, reading, pointing, happy, celebrate, encouraging, confused, helpful, error, sleepy, wake, wave, three peek states and four LAMTube states. Actual status aliases resolve to those states. These are restrained presentation equivalents, not 26 unique painted poses. Gallery previews expose Idle, Thinking, Happy, Teaching and Greeting.

## 9. Signature motion

Orbit forms float gently; faceted forms tilt/refract; Guide/Arc/Halo use quiet attentive motion; ribbon forms drift laterally; companions use restrained buoyancy; Lantern/Lore use warm light. Contextual activity overrides idle signatures. Subtle is the default intensity; normal/expressive remain bounded.

## 10. Settings → LAM

A 22-card gallery, larger live preview, explicit “Use this LAM” control, in-use indicator, animation toggle, intensity, ambient appearances, rare peeks, celebrations, idle reactions and appearance-only reset. Thumbnail cards do not animate. Existing voice/provider/personality settings remain below the identity section. The local-preview release is also recorded in Update Logs, including the small safety/performance fixes.

## 11. Preference persistence

`settings.lamIdentity` is normalized on old-store migration, Guest restore, account restore and settings updates. It follows the existing browser-local account vault. Guest settings remain isolated. A new test verifies account A/B selections restore independently. **Cross-device sync is not implemented or implied**; the settings UI explicitly explains this.

## 12. Top bar

The 36px selected mark replaces the generic mark without expanding the top bar or changing Ask LAM interaction. Hover/focus gives a small attentive response. Existing mobile assistant-off/compact preferences still govern whether its trigger is present.

## 13. Expanded Ask LAM

The panel uses a larger 48px selected avatar; onboarding uses 96px. Typing/listening, thinking/transcription, first streamed text, speaking, tool activity, success and recoverable error map to the character. First text switches to responding, even while the request remains open. No changes to microphone permissions, prompts, authorization, provider routing or open/close choreography.

## 14. LAM AI

The empty-state presence uses the selected 120px avatar. Conversation marks use the same identity; historical marks are static rather than continuously reacting. Live thinking/streamed turns retain activity. Personality-specific backgrounds, composer, dock, memory and sessions remain unchanged.

## 15. Chapter Command Centre

Chapter Ask LAM uses the chosen identity in its companion/status row and welcome view. Loading, draft/listening, teaching and failure states are connected to existing events. Chapter scope, prompts and flow routing are unchanged.

## 16. LAMTube

A small selected companion and CSS tiny computer sit in the existing LAMTube navigation area, outside the video surface. Desktop uses 82px artwork and mobile 60px. Video browsing, generation, queue and YouTube playback are untouched.

## 17. Look-back/shrug

Click: look-back → 650ms shrug → 1600ms return → 2300ms watching. A synchronous ref lock prevents overlapping clicks before React renders. A 12-second cooldown prevents repeated reactions. All timers are cleared on unmount and interrupted by hidden/reduced-motion/animation-off conditions. No sound or AI call is involved.

## 18. Ambient peek engine

One 15-second eligibility check, minimum five-minute cooldown, at least 20 seconds of quiet, and a large desktop viewport. Only calm browsing routes are allowed. Typing, any active LAM work, panels/dialogs, fullscreen, hidden tabs, reading/test routes, mobile and disabled motion suppress peeks. Candidate margins are hit-tested to reject controls, cards, notifications, document/video surfaces and footers. Pointer/key input and captured **nested scroll** dismiss immediately. One four-second appearance is decorative, non-interactive and cannot steal focus. The dev-only preview bypasses time delays, never safety guards, and is absent from production builds.

## 19. Additional placements

Exam Ready's teacher/overview `LAMVisual` now uses the shared identity. Existing `LamMark` consumers automatically use the registry. No new floating character was added to unrelated pages.

## 20. Personality

Avatar choice is visual only. Provider configuration, prompt personality, teaching mode, memory and entitlements are not coupled to it. No backend intelligence behavior was rewritten.

## 21. Reduced motion

OS `prefers-reduced-motion`, Scholar global/accessibility reduce-motion and battery mode override animation preferences. CSS provides a second OS-level safety rule. Hidden tabs pause CSS animation, hide peeks and cancel the LAMTube sequence. Static artwork remains usable.

## 22. Accessibility

Decorative artwork has empty alt text and `aria-hidden`; blinks are not announced. Gallery and LAMTube actions use real labeled buttons, keyboard focus rings and pressed states. Settings toggles/select are labeled. Peeks have no pointer interaction. No new camera, microphone or motion permissions are requested.

## 23. Mobile

Two-column gallery, wrapping preview controls, smaller artwork/computer and no peeks. Verified at 390×844 with document scroll width equal to viewport width. The chosen character does not change existing mobile LAM visibility preferences.

## 24. Android WebView

Uses normal images, CSS and existing React/Zustand rather than device sensors, canvas rigs or native bridges. Includes CSS reduced-motion fallback; no ambient peeks on small viewports. Real Android-device/WebView instrumentation was not run; an actual supported-device check is still required before release.

## 25. Performance

One scheduler/listener owner, passive captured scrolling, no per-character interval, no pointermove tracking, no MutationObserver, no frame loop and no provider call for reactions. Identical presence updates do not notify subscribers. Old conversation artwork and gallery cards are static. Visibility stops motion; timers clean up. Existing dependency set is unchanged.

## 26. Asset optimization

Two shared original source sheets (~5.5 MB combined) are preserved for fidelity. Next Image serves size-selected optimized derivatives: header requests a small shared sheet, gallery uses lazy-loaded thumbnails, and repeated cards reuse image URLs/cache. No 22 full-resolution eager downloads are introduced. The references include surrounding cosmic art, so the current crop/mask is not a true transparent cutout. Approved standalone transparent sprites would improve detail and cache efficiency further.

## 27. Files changed

New: `src/lib/lam/{identity,presence}.ts`; `src/components/lam/{lam-avatar,lam-identity-settings,lam-presence-runtime,lamtube-companion}.tsx`; `lam-identity.module.css`; `src/app/api/lam/identity/route.ts`; the two `public/lam/identity/*.png` sheets; `tests/lam-identity.test.ts`; this report.

Updated: `src/lib/{store,v2/flags}.ts`; `src/components/{app-shell,lam-widget}.tsx`; `src/components/lam/lam-mark.tsx`; `src/components/views/{settings,live-tutor,nigtube}.tsx`; `src/components/chapter-command/workspace.tsx`; `src/components/exam-ready/{presentation,teacher-panel}.tsx`. No unrelated page styles were redesigned.

## 28. Schema

No database/Prisma migration, new provider or package required. The existing feature-flag registry gains `v2_lam_identity`.

## 29. New tests

13 tests cover all reference forms/crops/assets, byte-identical sources, allowlisted migration, appearance/personality separation, account restore, actual status aliases, owner priority/cleanup, notification deduplication, visibility/reduced motion, peek suppression/cooldowns, click spam and disabled rollout.

## 30. Exact test results

- `bun test tests/lam-identity.test.ts tests/account-workspace.test.ts`: **18 passed, 0 failed, 283 assertions**.
- Every `tests/*.test.ts[x]` file was run in a separate Bun process: **81 files checked; 80 passed, one file had three failures**. `tests/personalization-security.test.ts` fails its private-resource extraction-queue, failed monthly-upload reservation and original-PDF preservation cases. Those tests and their PDF implementation files were not modified by this identity work. They need separate repair; the whole repository is not claimed green.
- An earlier grouped relevant run had provider tests affected by another test's `mock.module` pollution. `bun test tests/live-tutor-provider-reliability.test.ts` alone: **8 passed, 0 failed**. The isolated full-file run avoids that pollution.
- Live-provider tests skipped their explicit opt-in gates; no new billed generation was performed for identity QA.

## 31. TypeScript

`bunx tsc --noEmit`: passed after integration and the final code refinements.

## 32. Lint

`bun run lint`: passed after correcting render-time ref use and reaction reset cleanup. React review emphasized deduplicated listeners, derived state, static historical marks and passive scroll capture.

## 33. Production build

`bun run build`: **passed**. Next.js compiled successfully, completed its TypeScript check and generated all 66 static pages. The new `/api/lam/identity` route is included. Final `git diff --check` also passed (only the repository's existing LF/CRLF notices).

## 34. Browser QA

Local browser QA at 1440×1000, 1280×720 and 390×844, including the actual optimized production build. Verified preview vs apply, Nexus selection propagating to header/panel, reload persistence, attentive typing, thinking, recoverable guest error, panel close, LAMTube sequence/cooldown, visible safe peek, mobile two-column gallery, motion-off and mobile peek suppression. Default Aurora restored after checks. Production gallery had **zero warning/error console entries**, all 23 rendered gallery/preview images loaded, and no dev peek button. OS reduced-motion emulation stopped every character animation; the temporary emulation was reset. Previewing Wisp left the saved header as Aurora until Apply, as intended. The working deliverable's viewport was reset to the browser's normal size after QA.

## 35. Screens visually checked

Screenshots in `test-artifacts/lam-identity-*.jpg`: desktop/production gallery, attentive/helpful panel, visible safe peek, LAMTube reaction/mobile, mobile/production gallery, chapter desktop and Exam Ready landing. The source illustrations and saved screenshots were inspected directly. All gallery assets loaded. Screenshots are evidence, not alternate/generated designs.

## 36. Known limitations

Single-pose reference artwork cannot supply genuine eyelid/arm rigs or a rear-view pose. Cross-device appearance sync is unavailable. Paid/authenticated LAM AI and live speech/streaming were not end-to-end browser-tested against production for this local-only request; their existing activity paths were wired and their relevant unit files were run. Exam Ready's landing presence was browser-checked, not a newly generated live lesson. Local feature-flag DB lookup warns about an existing invalid PostgreSQL configuration and safely falls back to configured defaults. Development HMR logged stylesheet-refresh errors while editing; the optimized production gallery subsequently had a clean warning/error console. Three unrelated PDF security/import tests remain failing.

## 37. Deferred placements

No decorative expansion into music, quiz, e-book reading margins, assignments or every button. Future placement should require a clear study benefit, preserve content space, reuse the renderer and honor all suppressions. Approved pose assets and account-settings cloud sync are future work, not silent placeholders.

## 38. Safe release requirements

**Do not deploy this local implementation without review/authorization.** Review exact artwork and motion, fix the unrelated PDF test failures, verify a signed-in staging stream/tool/speech flow and real Android devices, check image optimization/cache behavior, and confirm the existing production flag service configuration. `V2_FLAG_LAM_IDENTITY=false` (or the existing DB override) disables character motion/presence and restores the legacy mark without granting/revoking LAM access. No database migration is required. Test normal, reduced-motion, animation-off and Guest/account switching before rollout.

## Maintenance guide

### Add an avatar

Add approved source artwork under `public/lam/identity/` and a registry entry with a unique ID, correct source dimensions/crop, signature family and valid fallback. Never replace artwork with a generic approximation. Keep image URLs internal/allowlisted. Update crop-bound/reference tests and visually inspect small header + mobile + gallery sizes. A thumbnail may share a sheet only when its displayed request remains appropriately small.

### Add a state or signature override

Add the state to `LAM_STATES`, map genuine existing activity in `resolveLamState` when needed, and add scoped CSS using transform/opacity with a static fallback. Add family-specific `[data-signature]` overrides rather than duplicating renderers. Respect `data-still`, `data-paused`, intensity and CSS reduced-motion rules. Do not fabricate a new pose from a single raster by warping the face.

### Add a page placement

Render `<LamAvatar placement="…" state={actualState} size={…}/>` in existing reserved UI space. Register a new placement type/registry support if needed. Call `useLamActivity(actualState, busy, blocked)` once in the owner component; its cleanup releases the owner. Historical marks should use `animate={false}`. Decorative instances require no additional ARIA live announcements.

### Trigger reactions

Use actual user/activity state, not a provider request. Explicit animation `state` overrides coordinated default presence; it does not change intelligence. Bounded multi-stage actions must guard rapid clicks synchronously, enforce cooldowns, clear timers and interrupt on motion-off/reduced/hidden/unmount. LAMTube is the reference implementation. Do not add additional ambient schedulers: route ambient requests through the single shell runtime and its safe eligibility/margin checks.

### Preferences and peeks

Update `settings.lamIdentity` through the existing `updateSettings` action and normalized allowlist. Keep preview selection local until Apply. Reset only identity preferences. The developer peek button is for local visual QA and never bypasses contextual guards. Extend the calm-route allowlist deliberately; reading, exam and timed-work routes must stay suppressed.
