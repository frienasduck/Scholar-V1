# Your Scholar — cinematic interface handoff

Integrated into the existing Scholar application on 27 September 2026, not a separate HTML demo. The master Your Scholar specification takes precedence over the appended planet-site references.

## Experience

- Editorial, full-screen introduction; graphite atmospheric light fields and a CSS glass orb.
- Seven chapter markers across the existing eleven saved steps; selected glass choices, contextual feedback, directional transitions, keyboard focus and mobile reflow.
- Existing one-time 50 MB import allowance and optional Plus review remain intact. Existing per-file protections and entitlement gates still apply.
- Full-screen build: the exact supplied video, restrained readability tint, real server-stage copy and one orbital loader. Navigation/question cards are absent; recovery controls appear only on failure.
- Personalized welcome, up to five saved consequences, Enter my Scholar and Adjust preferences. Entry opens the existing real Scholar Today dashboard.

## Implementation and state

`personalization-flow.tsx` retains the existing profile revision/save contract, resume handling, analysis stream/polling, skip, entitlement checks and account-owned results. `question-stage.tsx` adds material/selection detail without changing stored preference values. `personalization-provider.tsx` only imports the new scoped presentation stylesheet.

`personalization-experience.css` supplies the scoped optical/editorial layer. `personalization-presentation.ts` maps saved steps to chapters and real analysis stages to human copy. `planet-journey.tsx` now presents the minimal build status. `build-backdrop.tsx` owns one late-warmed video and its resource cleanup.

Production-mode QA also reproduced an existing startup handoff failure: readiness was true, but an abandoned Motion exit retained an opaque, click-intercepting startup overlay with no animation running. `launch-readiness-gate.tsx` now keeps the original readiness coordinator and uses a CSS fade, immediate pointer release and bounded removal (500 ms, 120 ms for reduced motion). No early readiness bypass or authentication change was added. The resume regression now explicitly waits for readiness and then requires overlay removal.

## Performance and accessibility

Reuse the existing Liquid Glass runtime and Framer Motion dependency. Repeated choices use static Tier-2 surfaces, with no backdrop blur on narrow phones. No shaders, canvases, new libraries, per-card pointer listeners or expensive media filters were introduced. Movement primarily uses transform/opacity; reduced motion/transparency, coarse-pointer and unsupported-browser fallbacks remain available.

Video metadata warms only at later steps. Playback starts on analysis, pauses when hidden/reduced or during the reveal, and releases the source on disposal. Playback errors or a bounded 2.2-second readiness deadline select a lightweight CSS fallback. Media never gates actual completion, and no fake minimum loading delay is imposed. Effect replay also restores the source safely.

## Manual inspection

Open http://localhost:3000. New authenticated accounts use the existing first-login entry. Existing accounts can reopen it through Settings → Learning Profile → Edit preferences / Save changes. No account was reset to force the new interface.

## Verification

Validation passed: 54 focused unit/security/presentation tests; 13 production-mode browser regressions; a separate all-steps 21-viewport sweep; TypeScript, lint, production build and whitespace checks. Production browser checks include interrupted startup animations, resume/skip, saved edits, expired-exam recovery, keyboard/reflow, import, Plus, personalized dashboard, actual video playback/pause/disposal and blocked-video fallback.

Development runs also exposed a Next hot-reload `hmrRefresh` initialization error; the stable production run passed with no page errors. The local development server is restarted after the edits to clear the pending hot-reload cycle.

Browser account/API state is supplied by test fixtures; the live video check accesses the actual supplied CloudFront asset. This does not claim a live database-backed account creation/import or Google OAuth verification.

No backend/authentication changes, migrations, dependency installation, staging, commits, pushes, deployments or Android changes were made for this interface task. Earlier fixes are preserved.
