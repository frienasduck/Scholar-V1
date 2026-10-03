# Scholar Study Music 2.0 — implementation and verification

Date: 2026-10-03. Existing working tree preserved. No staging, commit, push, deployment, dependency installation, Android changes, or database migration application.

## Design correction

The replacement visual direction was removed following the user's correction. Study Music retains its original background video, dark/fuchsia glass hero, Instrument Serif italic heading (“Sound that helps you study deeper.”), navigation pill, responsive card grid, and bottom now-playing controls. My Songs, import, focus, and ambience extend this interface rather than replace it. Supporting page panels use the existing fuchsia/white material. The global floating player and its dialogs are the functional additions.

## Baseline problems and repairs

- The old floating player used a hidden iframe instead of a properly contained visible player. Playback now has one global official YouTube iframe with visible controls and a minimum 200px media height; it survives internal navigation.
- Player initialization initially omitted a video ID, producing a genuine YouTube error 2 during verification. The constructor now requires and receives a validated video ID, with safe initial start time. Clean browser playback was reverified afterward.
- Seeking now commands the real player, not just a displayed timestamp. Switching tracks clears stale seek commands. Live-radio telemetry is not treated as an enormous VOD timestamp or saved resume position.
- Dragging updates the actual floating DOM surface using pointer capture and one animation-frame update. Release snaps to a corner and saves normalized coordinates. Keyboard corner selection, resize bounds, and mobile safe-area placement are included.
- Close, collapsed, expanded, pause, volume, mute, repeat, shuffle, queue, queue reorder, play-next, and playlist controls now share one store. Closed players remain closed after refresh; restored sound is paused. The bottom page controls retain the last selected queue item instead of falsely reverting to the featured track.
- Unavailable or mislabeled legacy catalog selections were replaced or corrected. Thumbnails use trusted YouTube hosts with HQ/MQ/default fallback and a Scholar visual fallback for missing/placeholder images.
- The old page-local focus clock was replaced by a global deadline-based timer, with account-scoped recovery, pause/resume, optional break, context, and recent sessions. Completing study records once; breaks begin paused so unattended time is not silently credited.

## Functionality

### Personal library and import

Official YouTube oEmbed metadata preview supports HTTPS watch, youtu.be, Shorts, embed, and YouTube Music video links. IDs are canonicalized, playlist/tracking parameters discarded, arbitrary hosts/ports/credentials rejected, and duplicate songs prevented. No user-controlled URL is fetched by the server: metadata comes from a fixed official endpoint, with timeout, response-size bounds, deduplicated requests, bounded cache/inflight count, and rate limiting. Returned embed HTML is ignored. React renders titles as text.

My Songs supports play, queue, play-next, favorite, display-title edits retaining original attribution, reorder with buttons/desktop drag, playlist addition, and removal. Existing imported user songs were preserved during QA. Custom playlists can be created, edited, played, or deleted. Source attribution and original titles remain available.

Guest library state is device-local and distinct from each signed-in user's state. Signed-in cloud routes always use the authenticated server session owner, never a supplied user ID. Writes use revision-based compare-and-swap transactions. Conflicts require explicit retry/merge; same-revision unsynced deletions are not silently resurrected. Switching accounts aborts old requests and stops audio. Legacy class playlists migrate only into guest storage, not silently into a signed-in account.

### Focus and ambience

25/5, 50/10, 90/15, custom 1–180 minute study, custom 0–60 minute break, optional subject/chapter/goal, pause/resume, cancellation, and no-break mode are supported. Focus can be controlled from the header quick-space while visiting other sections and restored after refresh. Existing Scholar session/activity records and completion notifications are reused. At least 15 completed study minutes qualify for the existing +10 XP/+5 Coins completion reward; merely starting does not award anything.

Four separately mixed procedural Web Audio textures are available: soft rain, brown noise, white noise, and an ocean-like wash. These are Scholar-synthesized textures, not downloaded YouTube audio or field recordings. They use explicit user audio activation and can continue independently of YouTube. No medical or cognitive benefit is claimed. The soundtrack builder assembles a neutral temporary queue from existing tracks/favorites/tags; it does not claim to generate music or use an AI model.

### YouTube restrictions respected

YouTube videos remain visible in the official player, and original controls/ads are not blocked or overlaid. Minimizing now collapses the extra Scholar controls without pausing music or hiding the compact official video. Hiding the browser tab still pauses YouTube. Native ambience is the background-audio option. Internal Scholar navigation preserves the visible player. Scholar Plus removes Scholar promotions, not YouTube advertisements.

Follow-up playback fix: initialization keeps the requested play intent through YouTube's initial cue/pause events, and switching an actively playing track uses `loadVideoById`. Browser checks confirmed one-click startup both with an existing iframe and after closing/recreating it; minimizing left the actual media element unpaused with advancing playback time. No browser console errors. The 21 focused Study Music tests and TypeScript passed.

References: [official player parameters](https://developers.google.com/youtube/player_parameters), [required minimum functionality](https://developers.google.com/youtube/terms/required-minimum-functionality), [developer policy guide](https://developers.google.com/youtube/terms/developer-policies-guide).

## Catalog verification manifest

All 16 catalog identities/title/channel combinations were checked against official oEmbed on 2026-10-03. This establishes metadata availability, not a permanent guarantee of playback in every country/browser. Creator embedding permissions, live-stream URLs, and availability can change. Unknown durations remain unknown until playback; only the explicit three-hour rain and eight-hour coffee-shop source durations are entered. A missing image gets an intentional Scholar fallback, not a broken image.

| YouTube ID | Source/channel | Catalog selection |
|---|---|---|
| jfKfPfyJRdk | Lofi Girl | Lo-fi study radio |
| 7NOSDKb0HlU | Chillhop Music | Lo-fi study/relax radio |
| MVPTGNGiI-4 | Lofi Girl | Synthwave radio |
| rUxyKA_-grg | Lofi Girl | Sleep/chill radio |
| DWcJFNfaw9c | Lofi Girl | Sleep/chill |
| lCOF9LN_Zxs | Soothing Relaxation | Beautiful Piano Music Vol. 1 |
| jgpJVI3tDbY | Just Instrumental Music | Classical music selection |
| eKFTSSKCzWA | johnnielawson | Forest waterfall |
| q76bMs-NwRk | The Relaxed Guy | Three-hour gentle night rain |
| 1ZYbU82GVz4 | Soothing Relaxation | Flying |
| 2OEL4P1Rz04 | Soothing Relaxation | The Hidden Valley |
| VMAPTo7RVCo | Calmed By Nature | Eight-hour cozy fall coffee shop |
| K1881OmmQCE | Calmed By Nature | Vintage fall coffee shop |
| 4xDzrJKXOOY | Lofi Girl | Synthwave selection (old misleading ambient label corrected) |
| 5qap5aO4i9A | Lofi Girl | Lo-fi study selection |
| zAiIgYOH4Ys | ARJN - Topic | KALYANI (Remix) |

Legacy unavailable IDs mPZkdNFkNpr, 4Tr0otuiQUU, and w5jA8G0kS6E were replaced. The former xvT1jH8B9AM “Study Focus” label did not match its music source and was removed from that category. Legacy playlist IDs map through the corrected catalog manifest.

## Files changed for this task

Updated:

- `src/components/views/music.tsx`
- `src/components/views/music-widget.tsx`
- `src/lib/music-store.ts`
- `src/components/app-shell.tsx` (global music quick access; existing shell changes preserved)
- `src/components/views/settings.tsx` (Study Music 2.0 update log; previous entries preserved)
- `prisma/schema.prisma`

Added:

- `src/components/study-music/{player,library-runtime,tools,import-dialog,thumbnail,workspace}.tsx`
- `src/components/study-music/study-music.css`
- `src/lib/study-music/{model,catalog,focus,position,storage,ambience,metadata,youtube-player}.ts`
- `src/app/api/study-music/{library,metadata}/route.ts`
- `prisma/migrations/20261003193000_study_music_library/migration.sql`
- `tests/study-music.test.ts`
- `tests/study-music-routes.test.ts`
- This report and `test-artifacts/study-music-*.png` verification captures.

Earlier LAMTube and curated-shelf fixes in the dirty working tree were preserved, not reimplemented or reset. Unrelated screens were not redesigned for Study Music.

## Verification results

| Check | Result |
|---|---|
| Focused pure Study Music tests | 21 passed |
| Focused metadata/library route tests | 8 passed; run in separate process to isolate server mocks |
| PostgreSQL migration coverage | 5 passed; no database mutation |
| TypeScript (`bunx tsc --noEmit`) | Passed |
| Full lint (`bun run lint`) | Passed |
| `git diff --check` | Passed; existing LF/CRLF notices only |
| Prisma schema validation | Passed with process-local placeholder PostgreSQL URLs; validation did not connect or alter the database |
| Production build | Passed (`bun run build`); compiled, TypeScript completed, all 57 static pages generated |
| Original visual design | Verified in browser at laptop and mobile sizes |
| Playback | Clean official Chillhop iframe initialized with real ID/start=0, no error 2, playing state confirmed |
| Internal navigation | Notes retained the same single iframe ID and playing state |
| Dragging/corner controls | Real pointer drag changed player geometry; pointer release and keyboard corner positioning exercised |
| Responsive containment | 320×568 portrait: 304px player, 302px×200px iframe, no horizontal overflow, 90px bottom clearance. 844×390 landscape: full 200px video visible. 768×1024 and 1366×768 page layout checked |
| Mobile import | 390×844 centered dialog, 370px width, scrollWidth equal to clientWidth; official title/channel preview rendered |
| Focus recovery | Temporary 25-minute session paused, controlled from Notes, recovered paused after refresh; temporary session then canceled without completion reward |
| Closed/audio recovery | Closed player stayed closed after refresh; no sound auto-resumed |
| Clean post-build browser check | Passed: original hero/card interface rendered, no fresh console errors, no horizontal overflow |

Screenshots: `test-artifacts/study-music-restored-desktop.png`, `test-artifacts/study-music-player-mobile.png`.

## Remaining limitations and deployment prerequisites

1. The new `StudyMusicLibrary` migration is prepared but **not applied**. Signed-in database sync needs this table and a properly configured PostgreSQL deployment. Device-local guest functionality and metadata import work without it. The local Prisma CLI lacked `DB_DATABASE_URL_UNPOOLED`; the validation-only command used temporary placeholder URLs, not a database setup or credential change. Live signed-in cross-device sync was not exercised against a real PostgreSQL database; owner isolation/conflict handling was tested with route mocks.
2. Playlist-only import is explicitly not enabled without the official YouTube Data API. Video links with playlist parameters import that video only.
3. YouTube embedding can fail by creator/region/browser policy; errors provide retry and “Open on YouTube.” Browser verification confirmed one representative catalog stream, not every video in every environment. Only source metadata was checked across the full catalog.
4. Browser/tab backgrounding pauses YouTube by design. Minimizing only hides Scholar's extra controls, not the official video. A fully video-free music player needs licensed/direct audio sources rather than a hidden YouTube embed.
5. Web Audio procedural textures require a user gesture and browser audio support. Native output was not subjectively listening-tested. No service worker/offline app installation was introduced; textures work without fetching media once the running app has loaded.
6. The existing Scholar local session/reward architecture is retained. The new feature does not claim server-attested study time or change subscription/security architecture.

The local development server was restarted after the successful build and is available for manual inspection at `http://localhost:3000/music`.
