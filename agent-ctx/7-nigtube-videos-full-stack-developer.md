# Task 7 — Add 50+ YouTube videos and playlists to NIGTUBE view

**Agent**: full-stack-developer
**File modified**: `/home/z/my-project/src/components/views/nigtube.tsx`
**Export preserved**: `NigtubeView` (named + default export)

## What was done

### 1. Added 30 new videos to the VIDEOS array (existing 13 untouched → 43 total)

Grouped with section comments inside the existing `VIDEOS: Video[] = [...]` array.

**Science one-shots — PhysicsWallah (10):**
| Chapter | Video ID |
|---|---|
| Motion | Msy44HhRGRw |
| Matter in Our Surroundings | vawU6R8MaO0 |
| The Fundamental Unit of Life | GGNN3cl57DQ |
| Force and Laws of Motion | TovkhURONCA |
| Tissues | zQbIU6utPJ4 |
| Is Matter Around Us Pure? | K7X2m-E-Iq0 |
| Gravitation | JGTuuw1wz7Y |
| Atoms and Molecules | szsVvf1PU9s |
| Improvement in Food Resources | YMA9CtWicIM |
| Complete Class 9 Science Marathon | BeI58I7lftw |

**Maths one-shots — PhysicsWallah (8):**
| Chapter | Video ID |
|---|---|
| Number Systems | xn2HskGqSkI |
| Polynomials | roFOxpZtiV4 |
| Coordinate Geometry | CDJlqkp1hfI |
| Linear Equations in Two Variables | s6DFsuvWl-4 |
| Introduction to Euclid's Geometry | V3OaMQDynpw |
| Heron's Formula | HQ5_Gy4BZEU |
| Surface Areas and Volumes | DDr1vzPtBzM |
| Complete Class 9 Maths Marathon | UeR6tFxSCIw |

**SST one-shots — PhysicsWallah (12):**
| Chapter | Video ID |
|---|---|
| Complete SST Marathon | GjbN4F4ZKZo |
| Complete SST (Another) | lnWopg0NZFI |
| The French Revolution | XbZgOZY4lk0 |
| Socialism in Europe and the Russian Revolution | rIlbV96lVmw |
| India - Size and Location | CDJ2ZI50KFk |
| What is Democracy? Why Democracy? | vxO8eECuPRM |
| Electoral Politics | JJ6kq2wTjZE |
| The Story of Village Palampur | FhMV1qx_U88 |
| People as Resource | N8afXRqmaKI |
| Constitutional Design | nsQ6TSO0xCk |
| SST Basics / Bridge Course | URNG6a8BizQ |
| SST Most Important Questions | JQXZEFItM24 |

Each entry has reasonable estimates for `duration`, `views`, `uploaded`, matching `subject` ("Science" / "Maths" / "SST"), proper `chapter` name, and a chapter-aligned `description`. Avatars: ⚡ Science, 📐 Maths, 🌍 SST.

### 2. Added a new `Playlist` interface + `PLAYLISTS` export array (11 entries)

Defined alongside VIDEOS at module scope. Each playlist has `{ id, title, channel, channelAvatar, subject, videoCount, description }`.

Playlist IDs (verified against task spec):
- `PLVLoWQFkZbhVQXzaqvepVOIo6qaBktSts` — Magnet Brains Class 9 Maths
- `PLVLoWQFkZbhWYsg90ByY5256bcotkWMQi` — Magnet Brains Class 9 Science
- `PLVLoWQFkZbhU5VPIicuCcmVB2nLSLm1Mt` — Magnet Brains Class 9 SST
- `PLVLoWQFkZbhXc2vq3VG3rxFlIF2GJe4Ez` — Class 9 SST One Shot Revision
- `PLVLoWQFkZbhXGE3_EIzxBsbyoo60kjxST` — Class 9 Maths Quick Revision
- `PLcJiYBaxEj802UU_ZRZgGbfryN22kslWS` — Science Sprint Series
- `PLcJiYBaxEj83zXclLC4RruKWoeB6JxXjL` — Maths Sprint Series
- `PLcJiYBaxEj80Qc3wIYlHQmg2IhH-WR54M` — Complete Science in One Shot
- `PLf0dYueVuajZ3m4EySlFzhpvg2TkdJoNe` — BYJU'S Class 9 Maths
- `PLVONEN7ojmy_fCPC5TGZlC_zMVqHwYwlT` — Vedantu Class 9 SST
- `PL7eKoJuwryW4C6gbzMSri3yccqZqPsWkB` — Khan Academy Class 9 Maths

### 3. Added "Playlists" tab + dedicated view

- Extended `activeTab` union type to include `"playlists"`.
- Added a new tab button in the top nav (icon: `ListVideo`, label: "Playlists").
- Added `filteredPlaylists` `useMemo` that honours both `activeSubject` (Maths/Science/SST/All) and the search query (matches title/channel/subject).
- Added a new conditional render branch in the main content area: when `activeTab === "playlists"` (and no video is selected), the view shows a fuchsia-rose gradient hero ("Binge full courses.") plus a responsive grid (1/2/3/4 columns at sm/lg/xl) of clickable playlist cards.
- Each playlist card is an `<a target="_blank" rel="noopener noreferrer">` linking to `https://www.youtube.com/playlist?list={id}`. The card features a stacked-deck gradient thumbnail with a centered `ListVideo` icon, a subject badge (top-left), a video-count badge (bottom-right), and an `ExternalLink` hover indicator (top-right). Below the thumbnail: channel avatar, title, channel name, and a 2-line description.

### 4. Other changes

- Added `ExternalLink` to the `lucide-react` import list (used by the playlist hover badge).
- Existing functionality (video player, AI summary / flashcards / quiz / notes, comments, mini player, watch later, history, trending sort) is untouched and still functional.

## Verification

- `bun run lint` → **PASS** (0 errors, 0 warnings).
- VIDEOS array length: 43 (13 existing + 30 new). No duplicate IDs.
- PLAYLISTS array length: 11.
- No `English`/`Hindi` subject leakage in new entries.
- Dev server log shows clean compilation after the edit.
- File grew from 694 → 851 lines.

## Notes for downstream agents

- The `Playlist` interface and `PLAYLISTS` array are module-scoped (not exported as separate named exports) but are usable inside the file. If a future task needs them as named exports, simply add `export` before `interface Playlist` and `const PLAYLISTS`.
- The `filteredPlaylists` memo intentionally reuses the same `search` and `activeSubject` state used by the video grid — this keeps the subject filter and search bar consistent across both views.
- The playlist card's thumbnail is a CSS gradient (no YouTube thumbnail API for playlists), so it always renders correctly regardless of playlist visibility.
