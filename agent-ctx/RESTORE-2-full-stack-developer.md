# RESTORE-2 — Restore dev password gate, Cortis shorts, NIGTUBE videos

**Task ID**: RESTORE-2
**Agent**: full-stack-developer
**Date**: 2025 session
**Files modified (only these 3)**:
- `src/components/views/settings.tsx`
- `src/components/cortis-simulator.tsx`
- `src/components/views/nigtube.tsx`

## Objective
Restore 3 features that were lost in a revert:
1. Developer Mode password gate in Settings (password `inmfs123`)
2. Cortis Simulator "Red Red" intro video overlay with 3 YouTube shorts on the sides + main video + Skip button + title below
3. NIGTUBE: add 30 new PhysicsWallah one-shot videos + 11 curated YouTube playlists + a "Playlists" tab

## Work Log

### Feature 1 — Settings.tsx Developer password gate
- Added `Lock` to the existing `lucide-react` import block.
- Added module-level `const DEV_PASSWORD = "inmfs123";` after the imports.
- Added two state hooks inside the component:
  - `const [showDevPassword, setShowDevPassword] = useState(false);`
  - `const [devPasswordInput, setDevPasswordInput] = useState("");`
- Added `confirmDevPassword()` function — on match: `setDevMode(true)`, close dialog, clear input, `toast.success("Dev mode enabled")`; on mismatch: `toast.error("Wrong password")`, clear input.
- Updated the dev mode card text from "Developer Mode Active" to "Developer Mode {devMode ? 'Active' : 'Locked'}" and appended "Password required to enable." to the description.
- Changed the Switch `onCheckedChange`: when `v === true` calls `setShowDevPassword(true)` (opens dialog) instead of `setDevMode(true)`; when `v === false` calls `setDevMode(false)` + toast.
- Added a `<Dialog>` immediately after the dev mode card containing:
  - `<DialogTitle>` with Lock icon + "Developer Access"
  - `<Input type="password" placeholder="Developer password">` with `autoFocus` and `onKeyDown` Enter → `confirmDevPassword()`
  - Cancel button (closes dialog + clears input) and Unlock button (calls `confirmDevPassword()`, amber styling, Lock icon)

### Feature 2 — Cortis-simulator.tsx RedRedModal video container
- Replaced the previous 16-bar equalizer animation in `RedRedModal` with a new video container.
- Container structure (flex row, `items-stretch`, `gap-2 sm:gap-3`):
  - **Left column** (`hidden md:flex flex-col gap-2 w-32 lg:w-40`): 2 YouTube shorts in a vertical stack — `TFAU152vYt8`, `QDWHzcxF4T4`. Each `<iframe>` uses `aspect-[9/16] w-full rounded-xl` and the muted URL pattern `?autoplay=1&mute=1&controls=0&showinfo=0&modestbranding=1&loop=1&playlist=ID&rel=0&playsinline=1`.
  - **Middle column** (`flex-1 max-w-4xl flex flex-col`): main video + Skip button + title below.
    - Main video: `<iframe>` with `aspect-video w-full rounded-xl overflow-hidden` and the non-muted URL pattern `?autoplay=1&controls=0&showinfo=0&modestbranding=1&loop=1&playlist=ID&rel=0`. Main video ID reused from the first short (`TFAU152vYt8`) since no specific ID was provided in the task.
    - Skip button: absolutely positioned `top-3 right-3 z-10`, `cortis-glass-strong rounded-full` with ChevronRight icon, calls `onClose`.
    - Title "Red Red" (cortis-font-heading italic) and subtitle "CORTIS · Hit Single" rendered below the video (moved from above the equalizer).
  - **Right column** (`hidden md:flex flex-col gap-2 w-32 lg:w-40`): 1 YouTube short — `tNEpSOfsA3Y`. Same muted URL pattern + aspect ratio as left shorts.
- Increased modal max width from `max-w-lg` to `max-w-5xl` to accommodate the side shorts.
- Kept the "Now Performing" badge, lyrics section (slightly shortened to `min-h-80` and `text-xs sm:text-sm`), and Continue button.
- Kept the ambient orbs (fuchsia + violet blurs).

### Feature 3 — NIGTUBE videos + playlists + Playlists tab
- Added `ExternalLink` to the lucide-react imports (`ListVideo` was already imported).
- Added 30 new entries to the existing `VIDEOS: Video[]` array, all properly typed with all 9 fields (id, title, channel, channelAvatar, duration, views, uploaded, subject, chapter, description):
  - **10 Science one-shots** (channel "PhysicsWallah", avatar ⚡, subject "Science"): Msy44HhRGRw, vawU6R8MaO0, GGNN3cl57DQ, TovkhURONCA, zQbIU6utPJ4, K7X2m-E-Iq0, JGTuuw1wz7Y, szsVvf1PU9s, YMA9CtWicIM, BeI58I7lftw
  - **8 Maths one-shots** (channel "PhysicsWallah", avatar 📐, subject "Maths"): xn2HskGqSkI, roFOxpZtiV4, CDJlqkp1hfI, s6DFsuvWl-4, V3OaMQDynpw, HQ5_Gy4BZEU, DDr1vzPtBzM, UeR6tFxSCIw
  - **12 SST one-shots** (channel "PhysicsWallah", avatar 🌍, subject "SST"): GjbN4F4ZKZo, lnWopg0NZFI, XbZgOZY4lk0, rIlbV96lVmw, CDJ2ZI50KFk, vxO8eECuPRM, JJ6kq2wTjZE, FhMV1qx_U88, N8afXRqmaKI, nsQ6TSO0xCk, URNG6a8BizQ, JQXZEFItM24
  - All 13 original videos preserved → total now 43 videos.
- Added a new `Playlist` interface (7 fields: id, title, channel, channelAvatar, subject, videoCount, description) and a `PLAYLISTS: Playlist[]` array with 11 curated playlists (Magnet Brains full courses, PhysicsWallah revision series, Vedantu Sprint series, BYJU'S, Khan Academy, etc.).
- Extended the `activeTab` union type from `"home" | "trending" | "saved" | "history"` to include `"playlists"`.
- Added a new tab `{ id: "playlists", icon: ListVideo, label: "Playlists" }` between Trending and Saved in the desktop tab bar.
- Added a new conditional rendering branch in the "Video Grid View" — when `activeTab === "playlists"`:
  - A fuchsia/rose hero banner explaining the playlists collection.
  - Subject-filtered playlist grid (filtered by `activeSubject`).
  - Empty state if no playlists match the active subject.
  - Each playlist is a `<motion.a>` anchor (`href={https://www.youtube.com/playlist?list=${pl.id}}`, `target="_blank"`, `rel="noopener noreferrer"`) styled as a card with:
    - Aspect-video gradient header with ListVideo play button overlay
    - YouTube badge (ExternalLink icon) + video count badge + subject badge
    - Channel avatar + title + channel name + 2-line description
    - Hover scale + fuchsia title hover color
- Existing video grid rendering is preserved verbatim for the other tabs (wrapped in the `else` branch).

## Verification
- `bun run lint` → **EXIT 0** (0 errors, 0 warnings across the entire project).
- `bunx tsc --noEmit` → no errors in the 3 modified files (only out-of-scope errors in `examples/` and `skills/`).
- Dev server (`dev.log`) → continuously serving `GET / 200` with successful recompiles ("✓ Compiled in Xms") after each edit.
- Verified counts: 43 total videos (13 original + 30 new), 11 playlists, all 3 features wired through the UI.

## Foundation untouched
- `src/lib/*`, `src/app/*`, `src/components/ui/*`, all other views, `prisma/` — not modified.
- Only added 3 named lucide icons where missing (`Lock` in settings.tsx, `ExternalLink` in nigtube.tsx; `ListVideo` was already imported). `ChevronRight` was already imported in cortis-simulator.tsx.
- No new dependencies added.
