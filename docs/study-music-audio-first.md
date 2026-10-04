# Study Music: audio-first correction

Implemented on 4 October 2026. Scope is Study Music and its shared player; the existing Scholar page identity and other section designs are preserved.

## Media architecture

- `YOUTUBE_VIDEO_SOURCE` retains the official visible embedded player. The compact source viewport is at least 200 × 200 CSS pixels. Show video expands that same player; Minimize video returns it to compact form without replacing the iframe or restarting playback.
- `AUDIO_SOURCE` uses the same queue, favorites, My Songs, progress and volume controls with an HTML audio runtime. The initial registry contains original synthesized rain texture, ocean texture, brown noise and white noise. No YouTube media is extracted, downloaded or converted to audio.
- Old saved YouTube tracks migrate through the default source discriminator. Native identifiers and provenance are validated, including playlist and history references.

## Playback boundaries

YouTube pauses when the browser document becomes hidden, its source viewport is undersized/obscured, or a modal opens. A modal detaches the paused embed and restores it cued after closing; a playback gesture is required to resume. Minimized controls keep a visible source surface. Creator restrictions and browser autoplay restrictions are shown honestly rather than bypassed.

Native audio can continue while navigating Scholar or opening tools. Closing the music player stops playback. Original bounded WAV loops are generated locally and object URLs are revoked when their source is replaced.

## Interface

Square album artwork, current track/channel, favorite, transport controls, seek, volume and queue lead the listening panel. The labeled YouTube source is secondary. The existing library, playlists, focus session, ambience mixer and import tools remain in place. Responsive compact, expanded and mini-player states share a persistent runtime. Attribution remains visible near the bottom of the music workspace.

Settings includes a dedicated update-log entry, including the smaller playback, responsive, lifecycle and fallback fixes.

## Validation

- Study Music unit suite: 28 passing tests, 132 assertions.
- Study Music route suite: 8 passing tests, 25 assertions (run separately to isolate mocks).
- Typecheck, repository lint and optimized production build passed.
- Browser checks covered desktop, 390 × 844 and 320 × 568 phones, and 844 × 390 landscape; no horizontal page overflow was observed.
- Actual KALYANI YouTube playback was checked, including expand/minimize without iframe replacement. An unavailable creator radio returned the intended error state.
- Native playback was checked with no YouTube iframe, through a queue modal and navigation to Dashboard.
- Modal pause/detach and paused restoration were checked. Short-landscape native controls and expanded YouTube viewport remained usable.

Signed-in cloud synchronization and every external catalog video were not individually revalidated in the browser. API ownership/security behavior remains covered by the existing route tests; third-party video availability remains controlled by YouTube and its creators.

Screenshots are saved in `test-artifacts/study-music-audio-first-desktop-2026-10-04.png` and `test-artifacts/study-music-audio-first-mobile-2026-10-04.png`.
