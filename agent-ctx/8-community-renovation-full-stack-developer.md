# Task 8 — Community Renovation

**Agent**: full-stack-developer
**Task ID**: 8-community-renovation
**Goal**: Make the Community view feel ALIVE — way more posts/Q&A/groups, and the AI classmates must sound like REAL teenagers, not AI tutors.

## Files Touched
1. `src/lib/store.ts` — only the `forumPosts`, `qaItems`, `studyGroups` seed arrays (lines ~475–691). No type or action changes.
2. `src/components/views/community.tsx` — `AI_PERSONAS` (added `id`), `triggerAIReply`, `triggerAIAnswer`, `GroupsTab.send`, ForumTab post header, QATab question header.

## What Was Built

### 1. Seed data dramatically expanded
- **Forum posts: 6 → 15**. Each post has a real-sounding title + body in lowercase Gen Z energy. Each has 3–5 replies that mix jokes, off-topic banter, helpful answers, and direct callouts between classmates ("kabir u literally copied heron's in the test and got it wrong"). Covers all 5 subjects (Science, Maths, English, SST, Hindi) + a "General" subject (the cricket match post).
- **Q&A items: 3 → 8**. Includes both kept existing (speed/velocity, a^0=1, biome vs ecosystem) and 5 new ones with messy real-student phrasing ("is weight the same as mass??", "whats the difference between metaphor and simile i keep mixing them up", "if a train leaves delhi at 60 km/h..."). Each answer comes from a specific classmate with their personality (Kabir jokey, Ananya organized, Meera sarcastic, Diya thoughtful, Aarav knowledgeable).
- **Study groups: 3 → 5**. Existing 3 expanded to 8–13 messages each with inside jokes, typos, double-texts. Added 2 new groups:
  - **Class 9 General** (47 members, subject "All") — 12 messages of pure random class chatter (Kabir forgot the English hw was due tomorrow, Diya bails him out, Aarav "I told u guys abt this on monday")
  - **Last Minute Cram** (23 members, subject "Mixed") — 13 messages of 6-hours-before-test panic. Meera says "brb 5 min gonna get coffee" then comes back an hour later. Classic.

### 2. AI personas wired to server-side character system
- Added `id` field to each `AI_PERSONAS` entry: `kabir`, `ananya`, `diya`, `meera`, `aarav`.
- `triggerAIReply` now calls `askAI(prompt, \`classmate-${persona.id}\`, { temperature: 0.85 })` instead of `askAI(..., "default")`. New prompt explicitly tells the model: "Don't be a tutor. Don't be too helpful. Be casual, lowercase, maybe crack a joke or go slightly off-topic. 1-3 sentences max."
- `triggerAIAnswer` similarly updated — explicit anti-tutor instruction ("Don't be a tutor. Be casual, lowercase, can crack a joke. If you actually know the answer, give it but in your own voice (not textbook style)").
- `GroupsTab.send()` similarly updated — explicit group-chat framing ("Short, casual, lowercase. Can be a joke, can be off-topic, can double-text. Don't be a tutor. 1-2 sentences max.").
- Fallback error messages rewritten in-voice ("hmm let me think abt this one", "no idea lol. lemme check and get back to u", "lol true") instead of the old AI-sounding "Hmm, I'll think about this and get back to you! 😊".

### 3. Forum posts + Q&A are now properly expandable
- The entire post header (avatar, author, subject badge, time, title, body, replies count + chevron) is now ONE big button that toggles expansion. Previously only the small "X replies" link was clickable.
- Added an animated chevron (`motion.span` rotates 180° when expanded) so users see at a glance which posts are open.
- Hover state: subtle `bg-muted/40` background + focus-visible ring for keyboard users.
- Open state: `ring-1 ring-primary/30` on the Card to make it visually clear which post is expanded.
- Added `aria-expanded={isOpen}` for accessibility.
- Added `transition={{ duration: 0.25, ease: "easeInOut" }}` + `initial={false}` on AnimatePresence for smoother first-render behavior.
- When expanded, body text loses `line-clamp-2` so the full post is visible.
- Empty state for posts with zero replies: "no replies yet — be the first to respond" (italic muted).
- Reply input wrapper has `onClick={(e) => e.stopPropagation()}` so typing/clicking the input doesn't accidentally collapse the post.
- All reply/answer body text now uses `whitespace-pre-wrap break-words` so long unbroken strings (URLs, formulas) don't blow out the layout.
- Same treatment applied to QATab.

## Character Realism Compliance (per spec)
- ✅ Lowercase energy throughout seed data ("i keep forgetting", "ya i changed my mind")
- ✅ Slang used naturally, not forced ("ngl", "lol", "lmaooo", "bro", "fr")
- ✅ Inside jokes & callouts ("kabir u literally copied heron's in the test and got it wrong", "ananya trying to be the mom of the group as usual")
- ✅ Inconsistencies (Meera changes her mind about Heron's between posts; Kabir forgets the hw due date)
- ✅ Typing quirks (no punctuation, ALL CAPS sometimes "BRO YES", "AN HOUR")
- ✅ Off-topic posts (the cricket match one)
- ✅ Self-corrections ("...i added wrong. its 420. fml")
- ✅ Brb-and-disappear pattern (Meera in Last Minute Cram: "brb 5 min" → returns 1 hr later)
- ✅ Double-texts (Kabir "im in. 8pm?" then later "Legend. See you at 8!")
- ✅ Hindi post with romanized Hindi body for variety
- ✅ Typos acceptable (not polished)
- ✅ AI prompt explicitly tells the model NOT to be a tutor and to use lowercase/casual voice

## Verification
- `bun run lint` → exit 0 (0 errors, 0 warnings across the whole project).
- `npx tsc --noEmit` → 0 errors in `src/components/views/community.tsx` and `src/lib/store.ts` (errors in other agents' files like achievements/files/resources are pre-existing and out of scope).
- Dev server log shows clean compiles + all 200 responses. The "Fast Refresh had to perform a full reload due to a runtime error" warnings are pre-existing sandbox issues (noted in earlier worklog entries), not caused by these changes.

## Out of Scope (NOT modified, per spec)
- `src/app/globals.css`, `src/app/layout.tsx` — foundation.
- `src/lib/store.ts` types/interfaces and actions — only the 3 seed arrays were touched.
- `src/lib/ai.ts`, `src/lib/curriculum.ts`, `src/lib/shared.tsx`, `src/lib/nav.ts`, `src/components/app-shell.tsx`, `src/lib/pdf.ts` — foundation, untouched.
- `src/app/api/ai/route.ts` — already had the `classmate-*` personas defined; not modified.

## Notes for Next Agent
- For existing Neha users with persisted localStorage state, the OLD community seed (6 posts, 3 Q&A, 3 groups) will still show until they reset. New users / cleared storage get the new seed. To see the new content during QA, clear localStorage for the app.
- The `classmate-*` server-side personas (route.ts lines 95–108) currently have decent prompts but could be tightened further to enforce lowercase + typing quirks more aggressively. They're already much better than the old `default` persona though.
