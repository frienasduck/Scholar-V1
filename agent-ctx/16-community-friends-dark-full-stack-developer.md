# Task 16-community-friends-dark — Work Record

## Summary
Redesigned 2 views (community, friends) with dark cinematic aesthetic + fullscreen HLS video background. All existing functionality preserved.

## Files modified
- `src/components/views/community.tsx` (1001 → 970 lines)
- `src/components/views/friends.tsx` (359 → 470 lines)
- `package.json` — added `hls.js@1.6.16`

## Foundation files NOT modified
globals.css, layout.tsx, store.ts, ai.ts, curriculum.ts, shared.tsx, nav.ts, app-shell.tsx, pdf.ts — all untouched.

## Asme design system applied
- `ASME_CSS` constant injected via `<style dangerouslySetInnerHTML>`: `@import` Inter + Instrument Serif, `.asme-font-body`, `.asme-font-serif`, `.asme-glass` (rgba(255,255,255,0.01) bg, blur(4px), inset highlight, gradient border via `::before` mask trick), `.asme-glass-pill` (rgba(255,255,255,0.04), blur(16px)+saturate(180%)), `.asme-input`/`.asme-textarea` (transparent bg, white text, white/40 placeholder), `.asme-scroll` (thin custom scrollbar), `.asme-dialog-content` (dark dialog override), `.asme-select-content` (dark dropdown).
- `HLS_SRC = "https://stream.mux.com/kimF2ha9zLrX64H00UgLGPflCzNtl1T0215MlAmeOztv8.m3u8"`
- `HlsVideoBg` component: native HLS for Safari, dynamic `import("hls.js")` for others, fallback to display:none on failure. `absolute inset-0 pointer-events-none z-0` with `<video autoPlay muted loop playsInline className="w-full h-full object-cover opacity-100">`.

## Layout (both views)
- Outer: `relative min-h-[calc(100vh-4rem)] bg-black overflow-hidden -m-4 lg:-m-6`
- z-0: `<HlsVideoBg />`
- z-0: `<div className="absolute inset-0 z-0 bg-black/50" />` overlay
- z-10: `<div className="relative z-10 flex flex-col min-h-[calc(100vh-4rem)]">`
  - `motion.nav` (initial y:-20,opacity:0 → animate y:0,opacity:1) `asme-glass rounded-full px-6 py-3 flex items-center justify-between max-w-5xl mx-auto mt-6 w-[calc(100%-2rem)]`
    - Left: glass-circle icon + view name (text-white font-semibold text-lg asme-font-body)
    - Center desktop tabs (md:flex): asme-glass-pill container with tabs — text-white/60 inactive, bg-white/15 text-white active
    - Right: stat pill (asme-glass-pill px-5 py-2 text-sm text-white)
  - Mobile tab strip (md:hidden) with asme-glass-pill buttons
  - Hero: tagline (text-white/80 text-[10px] tracking-[0.2em] uppercase) → heading (asme-font-serif text-4xl md:text-[64px] text-white with bg-gradient-to-b from-white via-white/95 to-white/70 bg-clip-text text-transparent, `<em>` italic accent word) → subheading (text-white/60 text-sm max-w-xl)
  - Content cards: `asme-glass rounded-2xl`
  - Text: text-white primary, text-white/60 muted, text-white/80 body
  - Buttons: `asme-glass-pill px-5 py-2 text-sm text-white` with hover:bg-white/10
  - Inputs: `asme-input` (rounded-full, transparent, white text)
  - Footer: `mt-auto py-6 text-center` text-white/40 attribution

## Per-view headlines
- Community: tagline "CONNECT · LEARN · GROW TOGETHER" → "A new way to learn *together*"
- Friends: tagline "CHAT · CONNECT · STUDY TOGETHER" → "Meet your study *squad*"

## Community specifics
- Replaced shadcn `<Tabs>` with state-driven `tab: "forum" | "qa" | "groups"` + TABS array.
- **ForumTab**: AI_PERSONAS (5), pickPersonas, forumPosts/addForumPost/replyForumPost, pushActivity, addXP, submitPost, submitReply, triggerAIReply (staggered typing + `classmate-<id>` persona + lowercase teen prompt + fallback "hmm let me think abt this one"). Post cards = asme-glass rounded-2xl, whole header is expand button, animated chevron, line-clamp-2 when collapsed, ring-white/20 when open. Replies with AI badge (fuchsia). Reply input with onClick stopPropagation.
- **QATab**: Same pattern with qaItems/addQA/answerQA; triggerAIAnswer fallback "no idea lol. lemme check and get back to u".
- **GroupsTab**: studyGroups/sendGroupMsg/pushActivity; grid of asme-glass rounded-2xl cards (cursor-pointer, hover bg-white/5, group initial gradient avatar indigo→teal, members count, msg count pill, last-message preview). Active chat = full-height asme-glass rounded-2xl with back button, header, scrollable message area with asme-scroll, mine=bright glass-pill / theirs=white/5 backdrop-blur bubbles, typing indicator, input row.

## Friends specifics
- Tabs (Discover/Friends/Requests) in navbar + mobile strip.
- **Requests**: list of asme-glass rounded-2xl p-4 cards with avatar, name, bio, time, Accept (glass-pill with Check) + Reject (icon-only glass-pill with X). All actions preserved (acceptFriendRequest + addXP(10) + pushActivity + toast.success; rejectFriendRequest + toast).
- **Discover/Friends grid**: asme-glass rounded-2xl p-5 cards with status dot (emerald if <1hr active), avatar gradient (fuchsia-purple kpop / pink-rose students), Music icon for kpop, Korean/position subtitle, status badge (Friends / X/2 messages to unlock), Chat button (glass-pill).
- **Chat Dialog**: asme-dialog-content max-w-2xl h-[600px] dark glass, header (avatar + name + meta), scrollable messages with asme-scroll, mine=bright glass-pill / theirs=white/5 backdrop-blur bubbles, typing indicator (3 bouncing dots), input row with asme-input + glass-pill send button.
- All logic preserved: 10 friends (5 K-pop CORTIS + 5 students), friendRequests, sendFriendMessage/receiveFriendMessage, addFriendRequest (triggers after 2 messages from stranger — toast), acceptFriendRequest/rejectFriendRequest, askAI with `friend-<id>` persona + 8-message history + temperature 0.85, addXP(1) per reply, pushActivity on accept, auto-scroll on new message, disabled send button while typing.

## Verification
- `bun run lint` → exit code 0, no errors.
- `bunx tsc --noEmit` → zero TS errors in my 2 files.
- `hls.js@1.6.16` installed and importable via dynamic `import("hls.js")`.
- Dev log shows no compile errors related to either file.
