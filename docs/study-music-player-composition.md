# Study Music: compact controller / separate source

Targeted presentation correction, 4 October 2026. This supersedes the combined listening-card presentation described in `study-music-audio-first.md`; the media runtimes and library backend are unchanged.

## Composition

- The floating Scholar controller contains artwork, track/channel, seek, transport, shuffle/repeat, queue, favorite, volume and an active focus timer. It has no iframe. Desktop controls fit a 356px-wide glass panel; collapsing returns a small pill. Dragging, keyboard corner snapping and saved placement use the existing store.
- `YouTubeSourceSurface` is a separate sibling at a screen edge. Its actual compact iframe remains at least 200px in each dimension. Source placement avoids the controller and adapts to phones and short landscape screens.
- Show video and Minimize video resize the same iframe without remounting or restarting the song. YouTube's documented `controls=0` setting avoids a duplicate persistent transport toolbar; the official player itself is not masked, hidden or moved offscreen.
- Phones default to artwork/title/play/next with a tiny progress line. Tap the track or Open player for full music controls; short screens use a scrollable control body.
- The music workspace has a normal Continue Listening artwork card. The old page-level duplicate transport and large player reservation are removed. My Songs, playlists, favorites, queue, imports, focus and ambience remain in place. Attribution stays near the bottom.
- Native audio does not render a YouTube surface. YouTube retains the existing foreground/visible-source safety checks; minimizing the controller does not hide the source. Closing the player stops playback.

## Main files

- `src/components/study-music/player.tsx`: composition and responsive controls, existing playback runtime.
- `src/components/study-music/source-surface.tsx`: independent source view.
- `src/lib/study-music/player-layout.ts`: pure sizing/placement helpers.
- `src/components/study-music/study-music.css`: compact glass styles and mobile states.
- `src/components/views/music.tsx`: Continue Listening and removal of duplicate controls.
- `src/components/views/settings.tsx`: detailed update log.
- `tests/study-music-presentation.test.ts`: layout regression coverage.

## Verification

- Repository lint, TypeScript typecheck and optimized production build passed.
- 40 Study Music tests passed: 28 core tests, 8 API route tests and 4 presentation tests, run in separate processes to isolate route mocks.
- Actual KALYANI playback started from a track click. Show/Minimize video retained iframe `widget2` while the playhead advanced from 29.4 to 30.4 seconds. Pill mode retained the visible source; navigation into Notes retained the same iframe and advanced playback.
- Desktop keyboard corner snapping moved the controller and repositioned its source without overlap.
- Browser checks covered 1440×900, 390×844, 320×568 and 844×390. No horizontal page overflow was observed. The mobile compact controller measured about 68px tall, separate from a 200px-high source viewport. Expanded short-landscape video and controller fit side by side.
- Brown noise rendered no source surface or source iframe and remained playing after navigation into Notes.
- Browser console error/warning capture was empty during final checks. An unavailable external radio still showed the existing creator/availability fallback rather than being bypassed. Not every third-party track or signed-in cloud sync was manually revalidated.

Visual evidence: `test-artifacts/study-music-separated-controller-desktop-2026-10-04.png` and `test-artifacts/study-music-separated-controller-mobile-2026-10-04.png`.

Official embed references: [player parameters](https://developers.google.com/youtube/player_parameters), [iframe API](https://developers.google.com/youtube/iframe_api_reference). This describes implementation checks, not a certification by YouTube.
