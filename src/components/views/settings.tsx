"use client";

import { useStore, getLevelInfo } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge as UiBadge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { LearningProfileSettings } from "@/components/personalization/learning-profile-settings";
import { LamIdentitySettings } from "@/components/lam/lam-identity-settings";
import { AccountSecurity } from "@/components/account-security";
import {
  User,
  Palette,
  Shield,
  Database,
  Code2,
  LogOut,
  Save,
  Upload,
  Download,
  Trash2,
  Zap,
  Coins,
  Flame,
  Star,
  Trophy,
  AlertTriangle,
  RefreshCw,
  Gamepad2,
  Eye,
  MessageCircle,
  Globe,
  Instagram,
  Twitter,
  ArrowRight,
  Lock,
  GraduationCap,
  BookOpen,
  Check,
  Bot,
  Mic,
  Volume2,
  Brain,
  Sparkles,
  History,
  Gauge,
  Bell,
  SlidersHorizontal,
  ListChecks,
} from "lucide-react";
import { toast } from "@/lib/notifications/notification-api";
import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { clearLamProfile, loadLamState, updateLamPreferences } from "@/lib/lam/storage";
import type { LamPreferences } from "@/lib/lam/types";
import { microphoneErrorMessage, requestMicrophoneStream, stopMediaStream } from "@/lib/lam/microphone";
import {
  STARTUP_MODE_DEFINITIONS,
  type StartupLoadingMode,
} from "@/lib/startup/startup-modes";
import { useScholarAccess } from "@/components/subscriptions/subscription-provider";
import { CustomCommandsPanel } from "@/components/reminders/custom-commands-panel";
import { UserAISettings } from "@/components/ai/user-ai-settings";
import { PluginConnections } from "@/components/connections/plugin-connections";

const SCHOLAR_UPDATE_LOG = [
  {
    version: "SEPB staging · isolated release candidate",
    date: "October 8, 2026",
    title: "Safer staging and deployment boundaries",
    items: [
      "Prepared a separate release-candidate branch and Free staging project/database, without moving main or copying production users, files, subscriptions or session credentials.",
      "Candidate builds and migrations now check the intended project, dedicated database, secure direct migration connection and staging origin before running. Unconfigured candidates and candidate previews in the production project stop safely.",
      "Staging has independent session, connector, audit and background-worker secrets. Its metadata uses its own canonical origin and requests no search indexing; Scholar’s production identity and existing interface stay unchanged.",
      "Deployment uploads exclude unrelated prototypes, APK backups, historical browser artifacts and local configuration. Explicit staging setup and database-verification scripts log status, not credentials.",
      "The new empty database passed isolation and write-permission checks, and all 16 migrations applied successfully. The regression suite passed 886 cases with zero failures and 14 opt-in live cases skipped. Real controlled-account, OAuth/email, multiplayer, hosted AI and physical-device certification remain pending; this is not a public-beta readiness claim.",
    ],
  },
  {
    version: "SEPB candidate · October 8 update",
    date: "October 8, 2026",
    title: "Release-candidate fixes and Your Scholar controls",
    items: [
      "This update includes the PDF, account-switch, storage, privacy-cache, reader accessibility, guest preference and mobile/LAM/Canvas repairs detailed below, together with the release matrix, issue register and reproducible verification scripts.",
      "Your Scholar daily guidance and recommended-source shelf are now controlled by the Your Scholar switch in Learning Profile settings. It is off by default; turning it off keeps the saved learning profile and study work intact.",
      "The recorded hardening checks passed 880 unit cases and 12 live-provider probes, plus 16 HTTP smoke checks. Fourteen provider cases are skipped by the default unit command; twelve were separately verified live, with two image-generation checks not run.",
      "The SEPB audit remains NOT READY for public-beta certification: real authenticated private-data, multiplayer, hosted video and physical-device journeys are still outstanding, and production Drive/recovery-email configuration requires follow-up. Publishing these code changes is not a beta-launch certification.",
    ],
  },
  {
    version: "SEPB release candidate · local hardening",
    date: "October 6, 2026",
    title: "Safer uploads, account switching and small-screen controls",
    items: [
      "Onboarding PDF uploads dispatch processing using the private resource returned by their storage transaction, avoiding a second optional lookup after saving. The three red PDF tests now exercise faithful storage, rollback, quota release and parser-transfer preservation of original bytes.",
      "Explicit account changes temporarily remove the prior private workspace while the new server session resolves. Sign-in, sign-out and developer-access changes invalidate other tabs using a random marker without sharing account details or credentials. Silent focus refreshes keep verified content visible.",
      "Session storage totals now include standard uploaded E-Books as well as other files, matching the upload limit enforcement. API responses explicitly use private, no-store headers to prevent cross-session browser or CDN reuse.",
      "OAuth/recovery defaults and public metadata now use Scholar's current canonical domain. Explicit staging origins and local development remain supported; unsafe authentication origins are rejected.",
      "Small phone headers keep full-sized search, menu and notification controls without text overlap. Music and feedback quick controls remain reachable in mobile navigation; larger layouts keep their existing controls and design.",
      "Mobile Canvas leaves space between its drawing/zoom controls and Scholar's fixed bottom menu, and its height follows the visual viewport instead of enforcing a 520 px floor on short screens.",
      "Ordinary guest Notes now clearly explain their existing session-only limit and export-before-leaving action. The editor no longer labels these temporary notes as durably autosaved; authenticated local notes retain their existing storage behavior.",
      "Built-in E-Book chapter cards support Enter/Space navigation. Zoom, rotation, reader expansion, bookmark, page-note, OCR and page-number controls now have accessible names without changing their layout.",
      "Fresh guest preferences now write the current storage schema, so legacy migration no longer resets a newly selected mobile LAM mode on each refresh. Guest storage still excludes account files, notes, chats, coins and privileges.",
      "Tablet and phone-landscape LAM now uses the same 1,024 px desktop-dock breakpoint as Scholar navigation, preventing an undocked desktop capsule from covering header controls. Short Canvas layouts keep zoom controls inside the stage as well as clear of the bottom menu.",
      "Added a release matrix, issue register, value-redacted configuration check, isolated regression runner and non-mutating localhost HTTP smoke. These changes are a local release candidate, not a production deployment or a claim that authenticated, physical-device and live-provider release gates are complete.",
    ],
  },
  {
    version: "Pre-SEPB · performance engineering",
    date: "October 6, 2026",
    title: "A lighter engine, the same Scholar",
    items: [
      "The performance pass preserves Scholar’s layouts, typography, colors, rich backgrounds, Liquid Glass, transitions and features. The local production sample reduced Dashboard script bodies from 2.48 MB to 2.14 MB; this is not a guaranteed speedup on every device.",
      "All 22 LAM forms now use lossless crops of the unchanged reference artwork and display-sized image variants. The header’s measured image response falls from 52,864 bytes to 950 bytes. Missing-art fallback is isolated to each derivative instead of affecting every form from a source sheet.",
      "LAM activity and avatar subscriptions now track only relevant presentation values. The gallery no longer rerenders for unrelated reaction phases, scroll-driven presence recomputation is bounded, and peeks check eligibility before querying dialogs or hit-testing margins.",
      "Exam Ready and Music display clocks share one visibility-aware interval and listener, stop display ticks in hidden tabs, catch up from real timestamps and clean up after the last subscriber. Music’s focus-completion loop runs only when required, including restored unrecorded completions.",
      "Liquid Glass completes geometry reads before CSS writes, coalesces pointer frames and cancels a queued frame when the document hides. Existing materials, glows and animation timings remain intact.",
      "The closed assistant’s academic renderer, Dashboard PDF exporter and gated Music implementation are split into interaction or feature chunks. Teaching pages keep synchronous Markdown and MathML rendering; regression checks preserve spaced prose and explicit equations. PDF export opens its window during the user gesture before loading export code.",
      "Quick startup no longer warms Full-mode extras. Optional prefetch respects the selected mode, active and warmed routes, mobile budgets, Data Saver, slow connections and document visibility. Long prepares active feature implementations; explicit Full Loading retains all nine original module targets. Footer links preload on hover or keyboard focus instead of merely entering the viewport.",
      "Duplicate playback telemetry no longer publishes redundant updates. Playback progress cannot keep postponing dirty library saves. Music observes dialog mutations only for an active visible YouTube source and ignores unrelated chat or progress changes; dialog opening and closing remain detected. Native audio and compliant visible YouTube playback rules are unchanged.",
      "Overlapping session refresh events reuse a pending request; account switches supersede and abort it, and unmount cleans it up. Global flag reads share one query, retain the existing short TTL, back off after failures and invalidate safely after mutations without caching user entitlements.",
      "The service worker caches explicit public static assets, not private APIs, dynamic image endpoints or route/prefetch payloads. Uploaded PDF render cleanup explicitly releases canvas backing stores while retaining worker loading, bounded page rendering and actual OCR context.",
      "Added 26 performance regression cases and reproducible asset, audit and isolated-test scripts. The final run recorded 861 passes, 13 skips and three pre-existing PDF fixture failures; build, TypeScript and lint passed. Six viewport sizes showed no new horizontal overflow. Cold panel-opening spikes and authenticated or physical Android performance still need further verification.",
    ],
  },
  {
    version: "LAM living identity 2.0",
    date: "October 6, 2026",
    title: "Your chosen LAM, throughout Scholar",
    items: [
      "Living Identity 2.0 adds individual motion ranges for all 22 forms, body-posture transitions, contextual teaching/source props, small reactions and a shared priority controller. Error, teaching and real input interrupt ambient behavior immediately.",
      "The Ask LAM trigger has restrained desktop-only cursor awareness; Ask LAM and LAM AI have a dedicated visual presence tied to typing, thinking, speech and streaming. Chapter quiz feedback and Exam Ready checkpoints show bounded encouragement, not repeated celebrations or invented mastery.",
      "LAMTube’s atomic story now pauses, notices, turns, holds eye contact, shrugs, asks “What?”, turns back and resumes watching, with occasional shorter alternate reactions. Existing playback remains independent.",
      "One session clock retains greeting, recent interaction and peek counts across navigation. Quiet browsing progresses to rest after 90 seconds, sleepiness after 4 minutes and sleep after 8 minutes; returning interaction wakes LAM gently.",
      "New Quiet/Balanced/Lively presence, desktop cursor, reduced-character-motion and session-quiet controls preserve the existing gallery. Peeks alternate safe sides, are capped per session and never cover cards or controls; offscreen characters pause using one shared observer.",
      "Study Music reflects actual playback without touching the source player; built-in and uploaded E-Book reading/extraction feed quiet reading/scanning states. Exam deadline restraint is recalculated centrally, including still presentation in emergency mode. Mobile previews wrap cleanly and motion-off remains functional.",
      "All 22 approved reference forms are available in Settings → LAM. Preview a form and its animation states before explicitly applying it; appearance never changes teaching personality, intelligence or provider routing.",
      "The top Ask LAM mark, expanded assistant, LAM AI, Chapter Command Centre, Exam Ready teacher and LAMTube companion share the saved selection. Appearance follows the existing isolated Guest/account-local workspace; cross-device appearance sync is not yet available.",
      "LAM reacts to actual typing, listening, thinking, streamed responses, teaching, tool activity, completion and recoverable errors. Existing assistant opening and closing transitions are preserved.",
      "LAMTube adds a tiny-computer companion with a bounded look-back, shrug and return sequence, click-spam protection and a 12-second cooldown. It does not control or obstruct video playback.",
      "Rare desktop edge peeks check for clear margins and stay off during typing, reading, tests, dialogs, fullscreen, active requests and mobile use. Inner-page scrolling immediately dismisses a peek; one shell-level scheduler enforces a five-minute cooldown.",
      "Character animation, intensity, ambient appearances, peeks, celebration reactions and gentle idle reactions have separate controls. Scholar/device reduced motion and battery mode take priority; hidden tabs pause motion and cancel reactions.",
      "Original artwork is retained without redrawing. Optimized image variants, lazy gallery thumbnails, static historical-message marks and safe missing-art fallbacks keep the presentation lightweight.",
      "Browser QA corrected feedback that settled in the top bar but remained on the lesson avatar: each registered placement now reads its immutable owned state. Formula/question targets stay aligned, quiet intensity wins over major reactions, and decorative captions do not announce ambient activity to screen readers.",
      "Reference art is single-pose concept artwork. Current reactions use posture, props and timing; exact facial, limb and back-turn acting requires authored layered animation assets. OS reduced motion also disables scene and pseudo-element transitions directly.",
    ],
  },
  {
    version: "Reader & LAMTube · reliability repair",
    date: "October 5, 2026",
    title: "Clearer PDF reading and resilient visual lessons",
    items: [
      "Uploaded PDFs use a compact Scholar reader with full-width pages, chapter/page navigation and a dedicated document scroll area. Toolbar and pagination no longer overlay the document; page changes reset only the document scroll.",
      "Reader controls retain bookmarks, reviewed OCR text, Ask LAM, notes, summaries, practice and immersive book mode, with mobile navigation and reading progress.",
      "Fixed production PDF extraction and OCR worker paths being rewritten into module IDs by the bundler. Existing failed imports can be retried without uploading or paying another upload credit.",
      "LAMTube validates generated scenes, discards unused AI metadata and makes one bounded correction attempt while preserving strict geometry, cue and source checks.",
      "Supported Groq models now generate outlines and animated scenes with strict JSON-schema constraints, an explicit generation message and a larger bounded output budget; safe provider error codes help diagnose failures without exposing prompts or credentials.",
      "Malformed JSON returned as a provider 400 now uses the existing alternate-model fallback instead of incorrectly asking students to shorten their input.",
      "If the provider rejects a complex animation schema, the one alternate attempt uses JSON mode while retaining strict local scene, animation and source validation.",
      "Fixed the uploaded-book page lookup's PostgreSQL integer type so saved extraction and reviewed OCR text reach LAM instead of failing silently.",
      "The uploaded reader now owns its scrolling, keeping its toolbar and pagination in place when using page actions or dialogs.",
      "Corrected Tesseract 7's boolean/numeric engine adapter mismatch so bundled English OCR uses the intended LSTM core on production.",
      "Animation validation now supports opposing force arrows with bounded signed vectors, while rejecting negative sizes for other visual elements.",
      "Temporary provider rate limits pause saved video generation and resume after a cooldown, rather than forcing students to restart.",
      "Ask LAM from a book now opens a temporary mobile session even when the floating mobile assistant is off, without enabling hands-free listening or changing preferences.",
      "Fixed a video-edit lease race so playback progress, notes, bookmarks and favorites finish saving before the database ownership lock is released.",
      "Mobile PDF pagination reserves space for Scholar's bottom menu, keeping the page-number field and previous/next controls unobstructed.",
      "Configured Gemini speech produces seekable WAV narration. Groq-only configurations now show actionable model-terms and access errors instead of a generic failure.",
      "A new LAMTube lesson-studio loading view shows saved scenes, voice clips, the real storyboard and stage progress, with lightweight reduced-motion-aware animation and background continuation.",
      "Video failures now record safe stage diagnostics; completed stages and the existing successful-generation credit protections are preserved.",
    ],
  },
  {
    version: "Study Music · Plus access",
    date: "4 Oct 2026",
    title: "Study Music is now included with Scholar Plus",
    items: [
      "Free and guest users see Scholar's gold locked-feature preview instead of the music workspace. The menu and top music shortcut lead to this preview; Plus members retain the existing music interface and controls.",
      "Music playback, native ambience, focus timers and quick drawers stop when verified access is lost. Saved songs, favorites, queues and playlists are not deleted. Music imports and cloud-library read/write endpoints enforce Plus access on the server, including direct API requests.",
      "The Plus comparison and benefits now identify Study Music as Plus-only. Existing developer access and the explicit subscriptions-disabled global unlock continue to follow Scholar's central entitlement policy.",
    ],
  },
  {
    version: "Study Music · compact controller",
    date: "4 Oct 2026",
    title: "Music controls first, video source separate",
    items: [
      "The large merged video/music card is replaced by two independent surfaces: a compact liquid-glass Scholar controller with artwork, progress, transport, favorites, volume and active focus time; and a smaller official YouTube source near a screen edge. The redundant page-level transport bar and oversized empty listening dock are removed.",
      "YouTube's supported controls=0 option removes the duplicate transport toolbar without covering or altering the embedded video or branding. Show video resizes the existing source iframe and Minimize video restores its secondary footprint, preserving the track and playback position. Visibility, modal pause, creator restrictions and browser-gesture safeguards remain intact.",
      "Mobile defaults to an artwork/title/play/next bottom bar with a tiny progress indicator. Tapping the title or Open player reveals the full controls. Desktop dragging, keyboard corner snapping, saved placement and pill mode remain; source placement avoids the controller. My Songs, playlists, favorites, queue, metadata, native audio, focus and ambience retain their existing data and behavior.",
      "Continue Listening uses a normal artwork card, not a video. Ownership attribution stays at the bottom of Study Music. Native sound textures have no YouTube surface. No music backend or unrelated section redesign is included in this presentation correction.",
    ],
  },
  {
    version: "Study Music · audio first",
    date: "4 Oct 2026",
    title: "Your soundtrack leads; the video stays secondary",
    items: [
      "Study Music retains its fuchsia/glass identity with album-style artwork, track/channel attribution, progress, volume, queue, favorites, My Songs, playlists, focus timer and ambience. A shared persistent listening space docks on the music page and follows navigation as a mini-player.",
      "YouTube tracks keep an official, unobstructed source player of at least 200 × 200 pixels. Show video enlarges the same embed; Minimize video returns to the compact source without restarting. Minimizing music controls never hides the YouTube player or intentionally stops an otherwise visible track.",
      "YouTube playback pauses when its source is covered, undersized, outside view or the app is backgrounded. Modal tools pause and detach the embed, then restore it cued; closing the player stops playback. No hidden embeds, extraction or background-only YouTube workaround is used. Creator attribution and the ownership disclaimer remain visible.",
      "Explicit YOUTUBE_VIDEO_SOURCE and AUDIO_SOURCE types keep old YouTube libraries compatible. Scholar-original rain/ocean textures and brown/white noise are genuine native audio loops, with the same controls, mixed-source queue, favorites and playlists, and audio-only playback across section navigation. They are synthesized textures, not third-party recordings.",
      "Source switching clears stale YouTube events; browser playback restrictions and creator embedding failures show actionable messages. Scoped library protections, per-owner paused restoration, focus controls and independent ambience mixing are preserved.",
    ],
  },
  {
    version: "E-Book OCR · readable uploads",
    date: "4 Oct 2026",
    title: "Large pages and real page text for LAM",
    items: [
      "Uploaded PDFs open in the familiar large-page reader with chapter/page navigation, width-fit zoom, bookmarks, notes, OCR and chapter-specific study tools. Immersive Book Mode remains optional; normal pages no longer shrink to screen height. Phone navigation collapses and page zoom stays inside the reader.",
      "Private scanned pages can be rendered for English OCR, reviewed and edited before saving. Saved page text and source chunks update together, retain original PDF bytes and real page numbers, and invalidate outdated study aids. LAM, search, summaries and practice use this saved index.",
      "OCR language data is packaged locally instead of downloaded at runtime. Textbook column detection, image preprocessing, bounded jobs, timeouts and safe service errors improve recognition reliability. OCR is not guaranteed for handwriting, equations or non-English scans; review remains required.",
      "Built-in OCR uses the current book ID, cancels stale requests and keeps error messages out of saved text. Ask LAM can extract missing current-page text first; reviewed text takes priority. Book-specific class storage and active-reader context prevent one book's notes or stale file IDs from being reused for another.",
      "Real PDF rasterization/OCR and the Physics page-9 scan passed isolated tests, including 1,987 recognized characters at 78% confidence. Owner checks, atomic OCR save/index rollback, LAM prompt handoff, reader sizing and accessible controls have regression coverage. Laptop/phone layout checks use a public scan, not a signed-in uploaded-book session.",
      "Local live OCR, private upload and live LAM acceptance still require a working PostgreSQL configuration: the current environment reports Prisma P1012. Authentication, rate limits and ownership protections were not bypassed. This entry does not claim a production deployment or migration.",
    ],
  },
  {
    version: "4 Oct maintenance · detailed fixes",
    date: "4 Oct 2026",
    title: "The small fixes behind a more reliable Scholar",
    items: [
      "Private PDF uploads validate empty files, extensions, MIME, signatures and limits before processing. Unicode filenames use safe download headers; duplicate uploads and network retries reuse the existing book instead of creating ghost copies.",
      "Storage accounting includes uploaded books. Book, source, processing job and usage commitment save atomically; failed reservations can be retried. Saved uploads are not reported as failed just because an optional audit step fails.",
      "Long PDF extraction runs in checkpointed batches, skips saved pages and resumes indexing. Mixed scanned/text books retain searchable readable pages and original page numbers. Password-protected, corrupt and scan-only PDFs show honest, actionable errors.",
      "PDF runtime fonts, character maps and WASM assets are bundled for server routes, with Windows-compatible paths. Library/detail payloads contain bounded metadata; only requested page text is loaded, and visible PDF pages render lazily.",
      "Uploaded-book search debounces requests, cancels stale results and jumps to matching pages. Notes, bookmarks and reading position use account updates plus a validated device retry journal, with visible save failures, legacy-state recovery and retry controls.",
      "Book links restore the selected reader after refresh. Rename preserves user titles and updates source metadata; confirmed deletion clears PDF bytes, chunks, jobs, reading data and both class profiles' local journals without changing unrelated books.",
      "Ask LAM opens the existing top-bar assistant with private book/page context. Explicit page ranges constrain retrieval, citations retain real pages, and page/range practice clears old answers and cancels stale generation. Rendering and AI errors are shown separately.",
      "Guest upload dialogs fit laptop and phone widths, keep keyboard focus accessible and restore the upload trigger on close. Guest private-feature and Plus-locked screens share their new dark-gold treatments, responsive actions and reduced-motion behavior without relaxing access checks.",
      "LAM closing disables interaction immediately, preserves panel geometry during the exit, restores focus and handles rapid reopening. A bounded developer diagnostic checks LAMTube outline, scene and narration providers without printing keys or lesson content.",
      "Focused E-Book/security regressions, actual synthetic PDF parser fixtures, TypeScript, repository lint and production build passed. Real signed-in upload, cross-device, live AI and Android acceptance remain pending a working PostgreSQL environment and the additive reading-state migration; scanned-book OCR is not claimed.",
    ],
  },
  {
    version: "Uploaded E-Books · reliability repair",
    date: "3 Oct 2026",
    title: "Your own PDF, inside Scholar's shared reader",
    items: [
      "PDF selection now waits for explicit upload confirmation, with file validation, stable retry references, duplicate detection and actionable processing errors. Extraction checkpoints long books and reuses completed stages on retry.",
      "Uploaded books gain server-side page search, account-saved notes, bookmarks and reading position, rename and safe deletion. The shared reader and built-in book design are preserved. LAM and practice retrieve the selected readable pages; scanned pages are clearly marked as requiring OCR.",
      "Deployment requires the additive reading-state migration and configured PostgreSQL. Full signed-in, cross-device and live AI acceptance still needs verification in that environment; no production migration or deployment was performed during this repair.",
    ],
  },
  {
    version: "Guest session · refined private-feature screen",
    date: "3 Oct 2026",
    title: "A warmer welcome to private Scholar features",
    items: [
      "The shared guest sign-in screen now follows the supplied dark-gold reference, with a luminous frame, textured atmosphere, lock medallion, serif typography and a gold account action. A secondary Back to Scholar action returns to the dashboard.",
      "Mobile layouts keep the copy and both actions readable, with visible keyboard focus and reduced-motion support. Guest restrictions, account creation, sign-in and saved work are unchanged.",
    ],
  },
  {
    version: "LAM · smooth close",
    date: "3 Oct 2026",
    title: "A polished closing transition for top-bar LAM",
    items: [
      "The top LAM panel now fades and gently lifts away before its capsule returns. Onboarding, fullscreen and backdrop closing share the same lightweight transition, with no animated blur or layout resizing.",
      "Closing controls become inactive immediately, keyboard focus returns after the transition, and both Scholar and system reduced-motion preferences are respected. Escape and rapid reopening retain their existing behavior.",
    ],
  },
  {
    version: "Scholar Plus · new feature previews",
    date: "3 Oct 2026",
    title: "One refined interface for every Plus-locked section",
    items: [
      "Plus-locked sections now share the supplied dark-gold design: a luminous fine border, serif chapter-style heading, three numbered capability cards, and matching gold and dark-glass actions.",
      "Every preview retains its section-specific content, upgrade destination and back action. Small screens use a readable stacked layout, keyboard focus is visible, and reduced-motion preferences are respected. Free tools, saved work and server-side access checks are unchanged.",
    ],
  },
  {
    version: "Platform refinement · connectors & reliability",
    date: "3 Oct 2026",
    title: "Connected materials, clearer Plus previews and reliable study flows",
    items: [
      "Plugins & Connections introduces Google Drive with narrow per-file permission, encrypted server-only credentials, private PDF/Google Doc imports and revocation. Requires connector OAuth configuration and the PluginConnection migration before live use.",
      "Locked tools now explain their capabilities through shared glass previews. Implemented experiments show Plus access rather than Coming Soon; Slideshow generation is protected by server entitlements while saved decks remain viewable.",
      "Uploaded PDFs reuse Scholar's immersive E-Book reader, page rendering, search, bookmarks and reading progress, with page-specific LAM and practice. Scanned pages explicitly require OCR rather than claiming extracted content.",
      "LAM recognizes normal exam-planning requests, resolves named and relative dates, and proposes an ordered plan for explicit approval before adding it to Planner. Background videos reveal only when ready and pause when hidden; streaming scroll no longer repeatedly restarts smooth animation.",
      "Canvas carries an Early Beta badge, and LAM reuses its existing lightweight opening animation with reduced-motion support. The shared footer now follows the supplied glass reference: a central orb, luminous curved rim, responsive link columns and statement card. Section backgrounds fade out into the footer's fading atmosphere without fading text, controls or reading content. Compact reading layouts retain their smaller footer.",
    ],
  },
  {
    version: "Study Music 2.0",
    date: "3 Oct 2026",
    title: "Find your flow — a personal, persistent study soundtrack",
    items: [
      "A contained official YouTube player now follows internal Scholar navigation, with safe desktop dragging, corner snapping, remembered positions, phone-friendly controls, queue, shuffle, repeat and volume. Minimizing controls keeps music playing with the compact official video visible. First-click startup no longer loses its play request to cue events. Hiding the browser tab pauses YouTube; native ambience can continue.",
      "Preview supported YouTube links and save them to My Songs with real title, channel and thumbnail metadata. Manage favorites, playlists, queue order and recent listening; guests keep a separate device-local library. Private account sync requires the new StudyMusicLibrary migration.",
      "The corrected catalog contains 16 verified creator videos. Unavailable and mislabeled entries were replaced; thumbnail fallbacks and honest duration labels prevent broken artwork and invented timings.",
      "25/5, 50/10, 90/15 and custom focus sessions survive section changes and recover after refresh. Native rain, brown noise, white noise and ocean-like textures have independent mixer controls. Focus view, temporary soundtrack assembly and global quick controls keep study tools close by.",
      "Curated-resource discovery shelves were moved below each section's primary experience without removing imported learning resources.",
    ],
  },
  {
    version: "LAMTube · mobile & background generation",
    date: "3 Oct 2026",
    title: "Keep studying while your visual lesson is being made",
    items: [
      "AI lesson processing now runs in bounded server batches and resumes from Scholar's shared shell, rather than depending on the generator screen staying open. Saved stages resume when you return after closing Scholar.",
      "A new progress screen shows five creation stages, actual saved progress, gentle motion and a Continue in background action. Recoverable shared-AI cooldowns pause and resume without losing completed work.",
      "Your newest generated lesson appears first in LAMTube's video grid, with in-progress cards, private playback and the existing search, subject, saved and history filters.",
      "Mobile navigation has readable scrollable tabs, single-column creation settings and libraries, larger playback targets and a mini-player positioned above the phone menu. Heavy glass filters were removed from embedded playback.",
      "Standard PostgreSQL DATABASE_URL configurations are accepted alongside DB_DATABASE_URL. A legacy SQLite URL is not compatible; database-backed generation still requires PostgreSQL, its migration and configured narration access.",
    ],
  },
  {
    version: "LAMTube AI Video",
    date: "2 Oct 2026",
    title: "Visual lessons, inside one unified LAMTube",
    items: [
      "Create chapter-aware narrated visual lessons with animated diagrams, equations, graphs and captions; choose lesson length, teaching style, pace, aspect ratio and an available English voice.",
      "AI Video, its generator, advanced settings, library and player now share LAMTube's existing navigation, atmospheric background, typography and glass controls. The older /nigtube address remains compatible.",
      "Seek, change playback speed, bookmark moments and answer optional interactive checks. Ask LAM about the current scene, save notes, organize private lessons, duplicate drafts, repair scenes or regenerate narration.",
      "Generation uses resumable stages, private audio, ownership checks and success-based monthly accounting: Free accounts receive 10 full generations per month; verified Plus access has no monthly generation cap.",
      "A clearly labelled silent preview is available without live generation. Real generation requires configured providers, a reachable database and the new database migration; optional background scheduling is not enabled automatically.",
      "Reduced-motion support, lightweight timestamp-driven visuals, mobile layouts and readable controls preserve responsiveness without expensive glass filters over playback.",
    ],
  },
  {
    version: "Exam Ready · Early Beta",
    date: "2 Oct 2026",
    title: "An adaptive exam workspace with a clearer mission path",
    items: [
      "Exam Ready brings exam setup, confidence checks, a guided preparation path, chapter-aware LAM teaching, practice, recall, final review and mock exams into one workspace.",
      "Notes, formulas, mistakes, supporting resources, focus timers and progress stay beside the lesson. Guest preparations remain local and do not pretend to have live AI or verified readiness evidence.",
      "The workspace now fills the available screen beneath Scholar's header, with the sidebar open or closed. The menu marks it Early Beta and shows a dismissible warning about bugs and free access during beta.",
      "Exam deadlines suggest a realistic study budget; manual choices are preserved and daily study blocks update the total. Invalid schedules are rejected.",
      "Missions cover chapter concepts in order, keep completed work intact and adjust remaining time without restarting the same teaching repeatedly. Legacy plans retain their saved progress while missing coverage metadata is repaired.",
      "Chapter-specific offline guidance replaces repeated unrelated demonstrations. Answer feedback uses readable paragraphs and explicit math formatting, with improved mobile tools and checkpoint review before advancement.",
    ],
  },
  {
    version: "Resource Intelligence & chapter guidance",
    date: "2 Oct 2026",
    title: "Real study sources, with the familiar Resources interface",
    items: [
      "The shared resource catalog includes 126 real sources: 28 attributed readable snapshots and 98 original-source links, with publisher, rights and chapter mappings rather than invented resource counts.",
      "Restored the familiar Resources video background, study-library hero, tabs, filters and compact cards while keeping the imported catalog and new backend. Favorites, recent items and downloads work across library pages.",
      "Private PDFs, pasted text and notes feed a shared ingestion and processing pipeline with source search, reading, attribution, extractive study aids and source-grounded LAM support. Restricted sources remain links rather than unauthorized copies.",
      "Custom E-Book imports now integrate with resource processing, duplicate detection and private ownership checks, while retaining existing upload limits and onboarding allocation rules.",
      "Chapter Command Centre guidance connects study, questions, revision, resources and LAM to the selected chapter across Scholar; related study screens reuse the same source context.",
      "Added focused security and regression coverage plus implementation reports. Database migrations are included in this update but must be applied separately before database-backed features can operate.",
    ],
  },
  { version: "Public authentication", date: "27 Sep 2026", title: "A calmer welcome, open to everyone", items: ["Email sign-in and account creation are now public, with a focused Liquid Glass form and no learning questions before authentication.", "Google sign-in is available when configured. Existing accounts connect Google explicitly in Settings; matching email alone never merges accounts.", "Email verification and password reset use single-use links when the sender is configured. Your Scholar, Guest Mode, Developer Access and Free/Plus permissions stay separate."] },
  {
    version: "Scholar Plus system",
    date: "23 Sep 2026",
    title: "Clear premium access, useful Free limits",
    items: [
      "LAM AI tutoring is available on Free; premium AI model choices, Scholar Intelligence, JEE Focused Mode, selected Resources, Workspace insights and Group Study hosting remain Plus benefits.",
      "Free accounts can upload 3 private PDF E-Books and generate 3 mock exams per calendar month; Plus raises those limits to 20 and 30.",
      "Answer Lab accepts custom typed questions, while Practice Questions and Past Papers now show concise development notices.",
      "Study Music highlights Kalyani Remix as a Scholar Pick, promotional glass cards fit on mobile, and user-facing tutor labels now consistently say LAM AI.",
    ],
  },
  {
    version: "Responsive foundation",
    date: "22 Sep 2026",
    title: "Scholar now fits the screen you study on",
    items: [
      "The shared mobile shell now reserves safe space for bottom navigation and responds to the software keyboard instead of covering active controls.",
      "Dialogs, drawers, toolbars and dense tab rows stay reachable on small phones and tablets without creating page-wide horizontal scrolling.",
      "Dashboard, Files, E-Book, Quiz, Flashcards, Notes, Focus, LAMTube, Music, Settings, LAM AI and Group Study received targeted responsive repairs.",
      "The existing desktop interface, private-beta rules, Guest Mode, Group Study permissions, Follow Host and explicit microphone/camera consent remain unchanged.",
    ],
  },
  {
    version: "LAM AI Beta",
    date: "21 Sep 2026",
    title: "A voice-first tutor that stays in your Scholar",
    items: [
      "LAM AI is available under Learn with Calm Tutor, Exam Coach and Curious Scientist personalities; switching style keeps the same session and transcript.",
      "Talk after an explicit microphone tap, interrupt a spoken reply at any time, or continue by text in the same conversation. English (UK) is the launch voice.",
      "Auto, Groq, Gemini and NVIDIA controls reflect the providers actually configured on the Scholar server; unavailable models are never simulated.",
      "LAM can prepare guided study missions, use relevant mastery and revision signals, and propose allowlisted Scholar actions that require your confirmation.",
      "LAM AI memory is account-scoped and transparent: explicitly saved memories can be inspected and deleted from the tutor workspace.",
    ],
  },
  {
    version: "Group Study 3.0",
    date: "20 Sep 2026",
    title: "Multiplayer Scholar — one shared study workspace",
    items: [
      "A persistent Group Session now keeps room identity, participants, chat, current activity and optional live media together while the group moves through Scholar.",
      "Hosts can use Follow Host, Guided Freedom or Open Session, take the group to a feature, choose which room features are available and build a shared study path.",
      "Materials and synchronized PDF pages, Group LAM, quizzes, shared notes and focus sessions now participate in the same guided room context.",
      "Fast incremental chat, reactions, raise hand and participant presence stay available throughout the session.",
      "Optional WebRTC voice and camera use explicit participant controls. Hosts can allow or disable access but cannot remotely activate anyone's microphone or camera.",
      "Room authorization and feature permissions are enforced on the server, with room-scoped signaling and bounded media capacity.",
      "Mobile navigation, compact controls, safe-area spacing and the live-friends dock remain responsive across Group Study features.",
    ],
  },
  {
    version: "Group Study Beta",
    date: "16 Sep 2026",
    title: "Scholar Group Study — study together, live",
    items: [
      "Group Study is here in private beta: a hosted study room with a shareable code — learn together, think together.",
      "Hosts create rooms and admit participants themselves; participants join with just a name and a study code, no account needed.",
      "Shared PDF materials with a synced active page, so everyone studies the same document together.",
      "Group LAM: ask questions grounded in the room topic and shared materials, with summaries, flashcards and a shared five-question quiz builder.",
      "Live study chat with host announcements, plus synchronized focus timers, quizzes with host-controlled answer reveal, and polls.",
      "Shared room notes with host-controlled editing, raise hand, host mute/remove controls, room lock, pause and end for everyone.",
      "Scholar accounts are now public: sign in with email, create an account, or use configured Google sign-in. Guest Mode and accountless Group Study invites remain available.",
    ],
  },
  {
    version: "Website reliability pass",
    date: "10 Sep 2026",
    title: "Faster answers, safer saved work",
    items: [
      "AI Tutor now streams answers and has a Stop control. LAM and shared AI requests detect interrupted output and use bounded request deadlines.",
      "Mock-exam and answer-evaluation response formats now match their question and feedback screens.",
      "Fixed a reminder notification loop and crashes when older saved profiles were missing progress fields.",
      "Files persist locally across reloads. Account switching preserves separate local workspaces without deleting the previous account's saved work.",
      "Feature screens load on demand. Background videos pause when hidden, and nonessential playback respects reduced motion.",
      "Improved mobile settings tabs, useful note/file search, public help and privacy pages, and quieter Scholar Plus prompts.",
      "Unfinished social and visual previews are hidden from normal navigation. The repository worklog distinguishes verified flows from remaining account-dependent checks.",
    ],
  },
  {
    version: "V2.1 · Scholar Intelligence",
    date: "8 Aug 2026",
    title: "Scholar Intelligence — The Academic Brain",
    items: [
      "New Scholar Intelligence view (Learn → Scholar Intelligence): mastery, weak topics, mistakes, revision queue and exam intelligence in one place.",
      "Mastery Engine: subject → chapter → topic estimates (Unknown → Mastered) built from quiz results, practice, mistakes, revision recency and confidence ratings — always presented as an estimate.",
      "Knowledge decay: strong/mastered topics that haven't been revised become “Needs refresh” without destroying their underlying score.",
      "Weak Topic Radar: repeated struggles are flagged with severity, accuracy, last attempted and a suggested action (Revise / Practice / Watch / Ask Tutor / Create Reminder).",
      "Personal Mistake Book: wrong answers from quizzes and practice are collected automatically, classified (Concept / Formula / Calculation / Reading / Guess / Memory) and analysed with hedged pattern insights.",
      "Smart Revision Queue with spaced repetition (Again / Hard / Good / Easy) and manual reordering; priorities respond to exams, recency and mistakes.",
      "Exam Intelligence: days remaining, syllabus coverage, revision completion, weak chapters and a Preparedness estimate (never a score guarantee), plus CRASH MODE plans (Must Do / Should Do / Optional) when exams are close.",
      "Today with Scholar: a daily brief generated from real data — assignments, exams, weak topics, revision due and a focus recommendation.",
      "Weekly learning report with study time, accuracy, consistency and mastery movement vs the previous week; deeper trends are a Scholar Plus benefit.",
      "Server-side intelligence APIs (evidence ingest, state, revision): mastery is always recomputed from raw evidence server-side; client state is rendering-only.",
      "New additive database tables: MasteryRecord, PracticeAttempt, MistakeRecord, RevisionItem. Existing data is untouched.",
    ],
  },
  {
    version: "v5.3.0",
    date: "7 Aug 2026",
    title: "Scholar Plus Experience & Monetization Update",
    items: [
      "LAMTube pre-roll: free students see a 10-second liquid-glass Scholar Plus promotion before videos; Scholar Plus members go straight to playback.",
      "Ad-free LAMTube & Study Music for Scholar Plus — no video ads, no spoken promotions.",
      "Study Music spoken promotion: a UK female voice (Microsoft preferred) welcomes free students once per session before the first track.",
      "Achievements, Mind Map and Concept Galaxy are now visible Scholar Plus benefits — clicking any of them opens Scholar Plus.",
      "Generation limits reworked: quiz and slideshow usage is now enforced server-side and recorded only after a successful generation, so failed requests never burn daily quota.",
      "Live “X of Y generations used today” indicators in Quiz and the Slideshow Maker, with Scholar Plus shown as unlimited.",
      "AI Tutor shows one compact Scholar Plus card with the first answer only — answers are never blocked or replaced by promotion.",
      "Developer Mode hardened: only failed logins count toward brute-force limits, and failed/locked attempts are audited.",
      "Subscription entitlement hardening and centralized Scholar Plus routing across the app.",
      "Accessibility and mobile pass on all promotional surfaces (keyboard access, reduced-motion, non-colour indicators).",
    ],
  },
  {
    version: "v5.2.0",
    date: "7 Aug 2026",
    title: "Smart Reminders 2.0",
    items: [
      "Redesigned Smart Reminders into a command centre with Today, Upcoming, Calendar, All, Completed, Templates and Activity views.",
      "Natural-language quick add — type “Revise Laws of Motion tomorrow at 6 PM” and review Scholar's interpretation before saving.",
      "Advanced scheduling: daily / weekday / weekly / monthly / custom recurrence, repeat counts, multiple alerts and full editors.",
      "Talk Reminder: Scholar speaks reminders aloud, preferring Microsoft female UK voices, with voice, pitch, rate, volume and privacy controls.",
      "Smart Suggestions: AI proposes reminders from exams, weak topics, mistakes and postponed tasks — you approve every creation.",
      "Conflict detection (overlaps, quiet hours, past times, duplicates) and smart snooze/rescheduling with suggested new times.",
      "Reusable templates (Daily Revision, Homework, Exam Countdown, Focus Sprint and more), exam revision series and reminder history.",
      "LAM × FICA task automation: LAM can create, edit, complete, snooze, move, list and speak reminders, plus custom command phrases.",
      "Unified reminder persistence shared with Chapter Command Center — legacy reminders were migrated safely, per Class profile.",
      "Quiet hours, reminder digests, notification permission flow and a global due-reminder action centre.",
    ],
  },
  {
    version: "v5.1.0",
    date: "1 Aug 2026",
    title: "Original appearance restoration and usability pass",
    items: [
      "Restored Scholar's original typography and page-specific video backgrounds.",
      "Added developer-gated beta font controls.",
      "Added notification size, position and timeout controls with live preview.",
      "Added expandable Chapter Command AI and optional AI doubt resolution.",
      "Improved the Study Workspace widget picker and repaired inactive controls.",
    ],
  },
  {
    version: "v5.0.0",
    date: "31 Jul 2026",
    title: "Scholar-wide notifications and background work",
    items: [
      "Introduced Scholar liquid-glass notifications.",
      "Added completion indicators for background AI tasks.",
      "Improved file previews, slideshow generation and startup readiness.",
    ],
  },
] as const;

const AVATAR_EMOJIS = [
  "🦋", "🐱", "🐶", "🦁", "🦊", "🐰", "🐻", "🐼",
  "🐨", "🐯", "🦄", "🐸", "🐵", "🦉", "🐧", "🦜",
  "🐙", "🦕", "🌸", "🌟", "🚀", "⚡", "🎨", "📚",
  "🎯", "🏆", "💎", "🔥", "🌈", "🍀", "🦖", "🐳",
  "🦢", "🦌", "🦔",
];

const SUBJECTS = [
  { id: "maths", name: "Mathematics", icon: "📐" },
  { id: "science", name: "Science", icon: "🔬" },
  { id: "english", name: "English", icon: "📚" },
  { id: "sst", name: "Social Science", icon: "🌍" },
  { id: "hindi", name: "Hindi", icon: "🪶" },
];

const RESET_PARTS: { key: "notes" | "flashcards" | "tasks" | "quiz" | "activity" | "sessions" | "files" | "chat"; label: string; icon: string }[] = [
  { key: "notes", label: "Notes", icon: "📝" },
  { key: "flashcards", label: "Flashcards", icon: "⚡" },
  { key: "tasks", label: "Tasks", icon: "✅" },
  { key: "quiz", label: "Quizzes", icon: "🎯" },
  { key: "sessions", label: "Focus", icon: "🍅" },
  { key: "files", label: "Files", icon: "📁" },
  { key: "chat", label: "AI Chats", icon: "🤖" },
  { key: "activity", label: "Activity", icon: "📊" },
];

function xpThresholdForLevel(target: number): number {
  let total = 0;
  for (let lvl = 1; lvl < target; lvl++) total += 100 + (lvl - 1) * 50;
  return total;
}

// ===== Cinematic video background with custom fade system =====
function CinematicVideoBg() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fadeAnimRef = useRef<number | null>(null);
  const fadingOutRef = useRef(false);

  const cancelFade = () => {
    if (fadeAnimRef.current !== null) {
      cancelAnimationFrame(fadeAnimRef.current);
      fadeAnimRef.current = null;
    }
  };

  const animateFade = (target: number, duration: number, onDone?: () => void) => {
    cancelFade();
    const video = videoRef.current;
    if (!video) return;
    const startOpacity = video.style.opacity ? parseFloat(video.style.opacity) : 1;
    const startTime = performance.now();
    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const eased = progress * (2 - progress); // easeOutQuad
      video.style.opacity = String(startOpacity + (target - startOpacity) * eased);
      if (progress < 1) {
        fadeAnimRef.current = requestAnimationFrame(step);
      } else {
        fadeAnimRef.current = null;
        onDone?.();
      }
    };
    fadeAnimRef.current = requestAnimationFrame(step);
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      if (!video.duration || fadingOutRef.current) return;
      const remaining = video.duration - video.currentTime;
      if (remaining < 0.55) {
        fadingOutRef.current = true;
        animateFade(0, 500);
      }
    };

    const handleEnded = () => {
      video.style.opacity = "0";
      fadingOutRef.current = false;
      setTimeout(() => {
        video.currentTime = 0;
        video.play().catch(() => {});
        animateFade(1, 500);
      }, 100);
    };

    const handlePlay = () => {
      fadingOutRef.current = false;
      animateFade(1, 500);
    };

    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("ended", handleEnded);
    video.addEventListener("play", handlePlay);

    return () => {
      cancelFade();
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("ended", handleEnded);
      video.removeEventListener("play", handlePlay);
    };
  }, []);

  return (
    <video
      ref={videoRef}
      autoPlay
      muted
      playsInline
      poster="/backgrounds/scholar-poster.svg"
      preload="metadata"
      className="absolute inset-0 w-full h-full object-cover translate-y-[17%] z-0"
      style={{ opacity: 0 }}
    >
      <source src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260328_115001_bcdaa3b4-03de-47e7-ad63-ae3e392c32d4.mp4" type="video/mp4" />
    </video>
  );
}

export function SettingsView() {
  const [settingsTab, setSettingsTab] = useState("account");
  useEffect(() => { if (new URLSearchParams(location.search).has("drive") || location.hash === "#plugins-connections") setSettingsTab("connections"); }, []);
  const user = useStore((s) => s.user);
  const settings = useStore((s) => s.settings);
  const updateUser = useStore((s) => s.updateUser);
  const updateSettings = useStore((s) => s.updateSettings);
  const setAuthed = useStore((s) => s.setAuthed);
  const guestMode = useStore((s) => s.guestMode);
  const endGuestSession = useStore((s) => s.endGuestSession);
  const devMode = useStore((s) => s.devMode);
  const setDevMode = useStore((s) => s.setDevMode);
  const coins = useStore((s) => s.coins);
  const xp = useStore((s) => s.xp);
  const streak = useStore((s) => s.streak);
  const mastery = useStore((s) => s.mastery);
  const setMastery = useStore((s) => s.setMastery);
  const addCoins = useStore((s) => s.addCoins);
  const addXP = useStore((s) => s.addXP);
  const setStreak = useStore((s) => s.setStreak);
  const completeDailyChallenge = useStore((s) => s.completeDailyChallenge);
  const resetEverything = useStore((s) => s.resetEverything);
  const resetPart = useStore((s) => s.resetPart);
  const pushActivity = useStore((s) => s.pushActivity);
  const lamProfileId = `class-${user.scholarClass}`;
  const [lamPreferences, setLamPreferences] = useState<LamPreferences>(() => loadLamState(lamProfileId).preferences);
  const [speechVoices, setSpeechVoices] = useState<SpeechSynthesisVoice[]>([]);
  const access = useScholarAccess();
  const developerAuthorized = access.developerMode === true && access.access?.source === "developer";
  const appearanceUnlocked = access.has("appearance_lab");

  useEffect(() => {
    // Local state is presentation-only. It mirrors the signed server session
    // and can never grant developer capabilities by itself.
    if (devMode !== developerAuthorized) setDevMode(developerAuthorized);
  }, [devMode, developerAuthorized, setDevMode]);

  useEffect(() => {
    setLamPreferences(loadLamState(lamProfileId).preferences);
    const sync = (event: Event) => {
      const profile = (event as CustomEvent<{ profileId?: string }>).detail?.profileId;
      if (!profile || profile === lamProfileId) setLamPreferences(loadLamState(lamProfileId).preferences);
    };
    window.addEventListener("scholar:lam-state", sync);
    return () => window.removeEventListener("scholar:lam-state", sync);
  }, [lamProfileId]);
  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    const refresh = () => setSpeechVoices(window.speechSynthesis.getVoices());
    refresh();
    window.speechSynthesis.addEventListener("voiceschanged", refresh);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", refresh);
  }, []);

  const updateLam = (patch: Partial<LamPreferences>) => {
    updateLamPreferences(lamProfileId, patch);
    setLamPreferences((previous) => ({ ...previous, ...patch }));
  };

  const setHandsFreeLam = async (enabled: boolean) => {
    if (!enabled) {
      updateLam({ wakeWordEnabled: false });
      toast.info("Hands-Free LAM disabled");
      return;
    }
    try {
      // Keep the permission request in this switch's direct user-gesture call chain.
      const stream = await requestMicrophoneStream();
      stopMediaStream(stream);
      updateLam({ wakeWordEnabled: true, voiceInputEnabled: true });
      window.dispatchEvent(new Event("scholar:lam-resume-hands-free"));
      toast.success("Hands-Free LAM enabled", { description: "Say “Hey LAM” or “Okay LAM” while Scholar is open and active." });
    } catch (requestError) {
      updateLam({ wakeWordEnabled: false });
      toast.error(microphoneErrorMessage(requestError));
    }
  };

  const [form, setForm] = useState(user);
  useEffect(() => {
    setForm(user);
  }, [user]);

  // Developer access is verified only by the server; the password never ships in the client bundle.
  const [showDevPassword, setShowDevPassword] = useState(false);
  const [devPasswordInput, setDevPasswordInput] = useState("");

  async function confirmDevPassword() {
    try {
      const response = await fetch("/api/developer/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: devPasswordInput }) });
      const value = await response.json();
      if (!response.ok) throw new Error(value.error || "Developer Mode access denied.");
      setShowDevPassword(false);
      setDevPasswordInput("");
      window.dispatchEvent(new Event("scholar:session-changed"));
      toast.success("Developer Mode enabled", { description: "All Scholar features are unlocked for this secure session." });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Developer Mode access denied.");
    }
  }

  const lvl = getLevelInfo(xp).level;
  const [coinInput, setCoinInput] = useState(String(coins));
  const [xpInput, setXpInput] = useState(String(xp));
  const [lvlInput, setLvlInput] = useState(String(lvl));
  const [streakInput, setStreakInput] = useState(String(streak));

  useEffect(() => setCoinInput(String(coins)), [coins]);
  useEffect(() => setXpInput(String(xp)), [xp]);
  useEffect(() => setLvlInput(String(getLevelInfo(xp).level)), [xp]);
  useEffect(() => setStreakInput(String(streak)), [streak]);

  const importRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function saveProfile() {
    updateUser(form);
    pushActivity({ type: "settings", text: "Updated profile", icon: "👤" });
    toast.success("Profile saved");
  }

  function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image too large", { description: "Please pick an image under 5 MB." });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setForm((f) => ({ ...f, avatar: dataUrl }));
      updateUser({ avatar: dataUrl });
      toast.success("Profile photo updated!", { description: "Your new photo is now live." });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  function exportData() {
    const state = useStore.getState();
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `scholar-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Backup downloaded");
  }

  function importData(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        useStore.setState(parsed);
        toast.success("Data restored");
      } catch {
        toast.error("Invalid backup file");
      }
    };
    reader.readAsText(file);
  }

  function applyCoins(target: number) {
    const t = Math.max(0, Math.min(99999, target));
    const delta = t - coins;
    if (delta !== 0) addCoins(delta);
    toast.success(`Coins set to ${t.toLocaleString()}`);
  }

  function applyXP(target: number) {
    const t = Math.max(0, Math.min(99999, target));
    const delta = t - xp;
    if (delta !== 0) addXP(delta);
    toast.success(`XP set to ${t.toLocaleString()}`);
  }

  function applyLevel(target: number) {
    const t = Math.max(1, Math.min(99, target));
    applyXP(xpThresholdForLevel(t));
    toast.success(`Level set to ${t}`);
  }

  function applyStreak(target: number) {
    const t = Math.max(0, Math.min(999, target));
    setStreak(t);
    toast.success(`Streak set to ${t}`);
  }

  function doCompleteDailyChallenge() {
    completeDailyChallenge();
    toast.success("Daily challenge completed (+30 XP, +15 coins)");
  }

  return (
    <div className="scholar-settings scholar-responsive-page relative bg-black overflow-hidden -m-4 lg:-m-6">
      {/* Liquid glass + cinematic CSS */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&display=swap');
        .asme-glass {
          background: rgba(255,255,255,0.01);
          background-blend-mode: luminosity;
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
          border: none;
          box-shadow: inset 0 1px 1px rgba(255,255,255,0.1);
          position: relative;
          overflow: hidden;
        }
        .asme-glass::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: inherit;
          padding: 1.4px;
          background: linear-gradient(180deg, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0.15) 20%, rgba(255,255,255,0) 40%, rgba(255,255,255,0) 60%, rgba(255,255,255,0.15) 80%, rgba(255,255,255,0.45) 100%);
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          pointer-events: none;
        }
        .asme-serif { font-family: 'Instrument Serif', serif; }
        .asme-glass-input {
          background: transparent !important;
          border: none !important;
          color: white !important;
        }
        .asme-glass-input::placeholder { color: rgba(255,255,255,0.4) !important; }
        .asme-glass-input:focus { box-shadow: none !important; }
        .asme-tab {
          background: transparent;
          color: rgba(255,255,255,0.6);
          transition: all 0.2s;
        }
        .asme-tab:hover { color: white; }
        .asme-tab[data-state="active"] {
          background: rgba(255,255,255,0.01);
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
          color: white;
          box-shadow: inset 0 1px 1px rgba(255,255,255,0.1);
        }
      `}</style>

      {/* Video background */}
      <CinematicVideoBg />
      {/* Dark overlay */}
      <div className="absolute inset-0 z-0 bg-black/50" />

      {/* Content */}
      <div className="relative z-10 flex flex-col min-h-[calc(100vh-4rem)]">
        {/* Navigation bar */}
        <nav className="relative z-20 pl-6 pr-6 py-6">
          <div className="asme-glass rounded-full px-6 py-3 flex items-center justify-between max-w-5xl mx-auto">
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-2">
                <Globe className="h-6 w-6 text-white" size={24} />
                <span className="text-white font-semibold text-lg">Scholar</span>
              </div>
              <div className="hidden md:flex items-center gap-6">
                {["Account", "Appearance", "Data"].map((link) => (
                  <span key={link} className="text-white/80 hover:text-white transition-colors text-sm font-medium cursor-pointer">
                    {link}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-white text-sm font-medium cursor-pointer hidden sm:inline">{user.name}</span>
              <button
                onClick={async () => {
                  if (guestMode) {
                    endGuestSession();
                    toast.success("Guest session ended");
                    return;
                  }
                  await fetch("/api/auth/logout", { method: "POST" });
                  setAuthed(false);
                  setDevMode(false);
                  window.dispatchEvent(new Event("scholar:session-changed"));
                  toast.success("Signed out");
                }}
                className="asme-glass rounded-full px-6 py-2 text-white text-sm font-medium hover:bg-white/5 transition-colors"
              >
                {guestMode ? "End guest session" : "Sign out"}
              </button>
            </div>
          </div>
        </nav>

        {/* Hero heading */}
        <div className="relative z-10 flex flex-col items-center justify-center px-6 pt-4 pb-8 text-center">
          <h1
            className="asme-serif text-4xl sm:text-5xl md:text-6xl lg:text-7xl text-white mb-3 tracking-tight text-balance"
            style={{ fontFamily: "'Instrument Serif', serif" }}
          >
            Built for the curious
          </h1>
          <p className="text-white/60 text-sm max-w-xl">
            Manage your account, appearance, privacy and developer controls.
          </p>
        </div>

        {/* Tabs — liquid glass */}
        <div className="relative z-10 flex-1 px-4 pb-8 max-w-5xl mx-auto w-full">
          <Tabs value={settingsTab} onValueChange={setSettingsTab} className="w-full">
            <TabsList className="scholar-settings-tabs asme-glass grid grid-cols-2 min-[480px]:grid-cols-3 lg:grid-cols-5 h-auto w-full rounded-2xl p-1.5 gap-1 mb-4 [&>button]:min-w-0 [&>button]:min-h-11 [&>button]:px-2 [&>button]:whitespace-normal">
              <TabsTrigger value="personalization" className="asme-tab rounded-full text-xs px-3 py-2">Learning Profile</TabsTrigger>
              <TabsTrigger value="account" className="asme-tab rounded-full gap-1.5 text-xs px-4 py-2">
                <User className="h-3.5 w-3.5" />Account
              </TabsTrigger>
              <TabsTrigger value="academic" className="asme-tab rounded-full gap-1.5 text-xs px-4 py-2">
                <GraduationCap className="h-3.5 w-3.5" />Academic
              </TabsTrigger>
              <TabsTrigger value="subscription" className="asme-tab rounded-full gap-1.5 text-xs px-4 py-2">
                <Sparkles className="h-3.5 w-3.5" />Subscription
              </TabsTrigger>
              <TabsTrigger value="appearance" className="asme-tab rounded-full gap-1.5 text-xs px-4 py-2">
                <Palette className="h-3.5 w-3.5" />Appearance
              </TabsTrigger>
              <TabsTrigger value="lam" className="asme-tab rounded-full gap-1.5 text-xs px-4 py-2">
                <Bot className="h-3.5 w-3.5" />LAM
              </TabsTrigger>
              <TabsTrigger value="connections" className="asme-tab rounded-full text-xs px-3 py-2">Plugins &amp; Connections</TabsTrigger>
              <TabsTrigger value="privacy" className="asme-tab rounded-full gap-1.5 text-xs px-4 py-2">
                <Shield className="h-3.5 w-3.5" />Privacy
              </TabsTrigger>
              <TabsTrigger value="notifications" className="asme-tab rounded-full gap-1.5 text-xs px-4 py-2">
                <Bell className="h-3.5 w-3.5" />Notifications
              </TabsTrigger>
              <TabsTrigger value="updates" className="asme-tab rounded-full gap-1.5 text-xs px-4 py-2">
                <ListChecks className="h-3.5 w-3.5" />Update Logs
              </TabsTrigger>
              <TabsTrigger value="data" className="asme-tab rounded-full gap-1.5 text-xs px-4 py-2">
                <Database className="h-3.5 w-3.5" />Data
              </TabsTrigger>
              <TabsTrigger value="developer" className="asme-tab rounded-full gap-1.5 text-xs px-4 py-2">
                <Code2 className="h-3.5 w-3.5" />Developer
              </TabsTrigger>
            </TabsList>

            {/* ===== Account ===== */}
            <TabsContent value="connections"><PluginConnections /></TabsContent>
            <TabsContent value="personalization"><LearningProfileSettings /></TabsContent>
            <TabsContent value="account" className="mt-2">
              <AccountSecurity />
              <div className="asme-glass rounded-3xl p-6 space-y-6">
                <div className="flex flex-col sm:flex-row gap-6 items-start">
                  <div className="flex flex-col items-center gap-3 w-full sm:w-auto">
                    <div className="grid place-items-center h-20 w-20 rounded-2xl bg-white/5 text-4xl shadow-lg overflow-hidden ring-1 ring-white/10">
                      {form.avatar.startsWith("data:") ? (
                        <img src={form.avatar} alt="Profile" className="h-full w-full object-cover" />
                      ) : (
                        <span>{form.avatar}</span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="asme-glass rounded-full px-4 py-1.5 text-xs text-white hover:bg-white/5 transition-colors flex items-center gap-1.5"
                      >
                        <Upload className="h-3 w-3" /> Upload photo
                      </button>
                      {form.avatar.startsWith("data:") && (
                        <button
                          type="button"
                          onClick={() => { setForm({ ...form, avatar: "🦋" }); updateUser({ avatar: "🦋" }); }}
                          className="text-xs text-white/60 hover:text-white px-2 py-1.5"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                    <p className="text-[10px] text-white/40">or pick an emoji</p>
                    <div className="grid grid-cols-8 gap-1 max-w-[280px]">
                      {AVATAR_EMOJIS.map((em) => (
                        <button
                          key={em}
                          onClick={() => { setForm({ ...form, avatar: em }); updateUser({ avatar: em }); }}
                          className={cn(
                            "grid place-items-center h-8 w-8 rounded-lg text-lg transition-all hover:bg-white/10",
                            form.avatar === em ? "bg-white/15 ring-1 ring-white/30" : ""
                          )}
                        >
                          {em}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <GlassField label="Display Name">
                      <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="asme-glass-input" />
                    </GlassField>
                    <GlassField label="Username">
                      <Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} className="asme-glass-input" />
                    </GlassField>
                    <GlassField label="Email">
                      <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="asme-glass-input" />
                    </GlassField>
                    <GlassField label="School">
                      <Input value={form.school} onChange={(e) => setForm({ ...form, school: e.target.value })} className="asme-glass-input" />
                    </GlassField>
                    <GlassField label="Class">
                      <Input value={form.class} onChange={(e) => setForm({ ...form, class: e.target.value })} className="asme-glass-input" />
                    </GlassField>
                    <div className="sm:col-span-2">
                      <GlassField label="Bio">
                        <Textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} rows={2} className="asme-glass-input" />
                      </GlassField>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-white/10">
                  <button onClick={saveProfile} className="asme-glass rounded-full px-5 py-2 text-white text-sm font-medium hover:bg-white/5 transition-colors flex items-center gap-1.5">
                    <Save className="h-3.5 w-3.5" /> Save changes
                  </button>
                  <button onClick={() => setForm(user)} className="text-white/60 hover:text-white text-sm px-3 py-2">Reset</button>
                </div>
              </div>
            </TabsContent>

            {/* ===== Subscription ===== */}
            <TabsContent value="subscription" className="mt-2 space-y-4">
              <div className="asme-glass rounded-3xl p-6">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[.22em] text-cyan-200">Scholar access</p>
                    <h3 className="mt-2 text-2xl font-semibold text-white">{access.access?.source === "plus" ? "Scholar Plus" : access.access?.source === "developer" ? "Developer Mode" : access.access?.source === "subscriptions_disabled" ? "All Scholar features unlocked" : "Scholar Free"}</h3>
                    <p className="mt-2 text-sm text-white/55">{access.access?.source === "plus" ? "Active" : access.access?.source === "developer" ? "All features unlocked for this secure session." : access.access?.source === "subscriptions_disabled" ? "Subscriptions are currently disabled." : "3 quiz generations · 3 slideshow generations · 30 MB file storage"}</p>
                    {access.pendingPayment && <p className="mt-3 rounded-xl border border-amber-300/15 bg-amber-300/5 px-3 py-2 text-xs text-amber-100">Scholar Plus verification {access.pendingPayment.status.replaceAll("_", " ")} · {access.pendingPayment.publicReference}</p>}
                  </div>
                  {access.config?.subscriptionsEnabled && <button onClick={() => window.dispatchEvent(new CustomEvent("neha-scholar:navigate", { detail: { viewId: "plus" } }))} className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black">{access.access?.source === "plus" ? "View Scholar Plus plan" : "View Scholar Plus"}</button>}
                </div>
                <div className="mt-6 grid gap-3 sm:grid-cols-3"><div className="rounded-2xl bg-white/5 p-4"><p className="text-xs text-white/40">Quiz generations</p><p className="mt-1 font-semibold text-white">{access.usage?.quiz.used ?? 0} / {access.usage?.quiz.limit === -1 ? "Unlimited" : access.usage?.quiz.limit ?? 3}</p></div><div className="rounded-2xl bg-white/5 p-4"><p className="text-xs text-white/40">Slideshows</p><p className="mt-1 font-semibold text-white">{access.usage?.slideshow.used ?? 0} / {access.usage?.slideshow.limit === -1 ? "Unlimited" : access.usage?.slideshow.limit ?? 3}</p></div><div className="rounded-2xl bg-white/5 p-4"><p className="text-xs text-white/40">Files storage</p><p className="mt-1 font-semibold text-white">{((access.storage?.usedBytes ?? 0) / 1024 / 1024).toFixed(1)} MB / {((access.storage?.limitBytes ?? 30 * 1024 * 1024) / 1024 / 1024).toFixed(0)} MB</p></div></div>
                <div className="mt-5 flex flex-wrap gap-3"><button onClick={() => { window.dispatchEvent(new Event("scholar:install-app")); }} className="rounded-full border border-white/15 px-4 py-2 text-sm text-white">Install Scholar App</button><button onClick={() => void access.refresh()} className="rounded-full border border-white/15 px-4 py-2 text-sm text-white">Restore / recheck access</button>{access.pendingPayment && <button onClick={() => window.dispatchEvent(new CustomEvent("neha-scholar:navigate", { detail: { viewId: "subscription-payment" } }))} className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-sm text-cyan-100">Manage payment request</button>}</div>
              </div>
            </TabsContent>

            {/* ===== Academic Profile ===== */}
            <TabsContent value="academic" className="mt-2 space-y-4">
              <div className="asme-glass rounded-3xl p-6">
                <div className="mb-4">
                  <h3 className="font-semibold text-white flex items-center gap-2">
                    <GraduationCap className="h-4 w-4 text-white/70" /> Academic Profile
                  </h3>
                  <p className="text-sm text-white/50 mt-1">Choose your class. This switches all educational content, subjects, chapters, quizzes, AI tutors, and resources. Each class has completely separate progress.</p>
                </div>

                {/* Class selection cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                  {/* Class 9 */}
                  <button
                    onClick={() => {
                      if (!access.has("class_9_access")) {
                        window.dispatchEvent(new CustomEvent("neha-scholar:navigate", { detail: { viewId: "plus" } }));
                        toast.info("Class 9 requires Scholar Plus");
                        return;
                      }
                      if (user.scholarClass !== 9) {
                        window.dispatchEvent(new CustomEvent("scholar:class-switch", { detail: { newClass: 9 } }));
                        toast.success("Switching to Class 9…", { description: "Loading the Class 9 Scholar profile" });
                      }
                    }}
                    className={`rounded-2xl p-5 text-left border-2 transition-all hover:scale-[1.02] ${
                      user.scholarClass === 9
                        ? "border-indigo-400 bg-indigo-500/15"
                        : "border-white/15 bg-white/5 hover:border-white/30"
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-3xl">📘</span>
                      <div>
                        <p className="font-bold text-white text-base">Class 9</p>
                        <p className="text-xs text-white/50">Scholar · Class 9</p>
                        {!access.has("class_9_access") && <p className="text-[10px] font-semibold text-cyan-200">Scholar Plus</p>}
                      </div>
                      {user.scholarClass === 9 && <Check className="h-5 w-5 text-indigo-400 ml-auto" />}
                    </div>
                    <p className="text-xs text-white/60 leading-relaxed">Maths, Science, Social Science, English, Hindi — full CBSE Class 9 syllabus with 5 AI tutors.</p>
                  </button>

                  {/* Class 11 */}
                  <button
                    onClick={() => {
                      if (user.scholarClass !== 11) {
                        window.dispatchEvent(new CustomEvent("scholar:class-switch", { detail: { newClass: 11 } }));
                        toast.success("Switching to Class 11…", { description: "Loading the Class 11 Scholar profile" });
                      }
                    }}
                    className={`rounded-2xl p-5 text-left border-2 transition-all hover:scale-[1.02] ${
                      user.scholarClass === 11
                        ? "border-blue-400 bg-blue-500/15"
                        : "border-white/15 bg-white/5 hover:border-white/30"
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-3xl">⚛️</span>
                      <div>
                        <p className="font-bold text-white text-base">Class 11</p>
                        <p className="text-xs text-white/50">Scholar · Class 11</p>
                      </div>
                      {user.scholarClass === 11 && <Check className="h-5 w-5 text-blue-400 ml-auto" />}
                    </div>
                    <p className="text-xs text-white/60 leading-relaxed">Physics, Chemistry, Maths, Computer Science, English — PCM + CS with practicals, derivations, Python workspace.</p>
                  </button>
                </div>
              </div>

              {/* JEE Mode toggle — only for Class 11 */}
              {user.scholarClass === 11 && (
                <div className="asme-glass rounded-3xl p-6">
                  <div className="flex items-start gap-3">
                    <Zap className="h-5 w-5 text-orange-400 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-white">JEE Focused Mode</p>
                      <p className="text-sm text-white/50 mt-0.5">Transforms all content to JEE-level: advanced questions, JEE PYQs, competitive strategies, higher difficulty. Affects quizzes, mock exams, AI recommendations, Nightube, and analytics.</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-xs font-medium ${user.jeeMode ? "text-orange-400" : "text-white/40"}`}>{user.jeeMode ? "ON" : "OFF"}</span>
                      <Switch
                        checked={user.jeeMode}
                        onCheckedChange={(v) => {
                          if (v !== user.jeeMode) {
                            window.dispatchEvent(new CustomEvent("scholar:class-switch", { detail: { jeeToggle: true } }));
                            toast.success(v ? "Enabling JEE Mode…" : "Disabling JEE Mode…");
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Current profile info */}
              <div className="asme-glass rounded-3xl p-6">
                <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-white/70" /> Current Profile
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-white/40 text-xs">Active Class</p>
                    <p className="text-white font-medium">Class {user.scholarClass} CBSE</p>
                  </div>
                  <div>
                    <p className="text-white/40 text-xs">Profile Name</p>
                    <p className="text-white font-medium">Scholar · Class {user.scholarClass}</p>
                  </div>
                  <div>
                    <p className="text-white/40 text-xs">JEE Mode</p>
                    <p className={`font-medium ${user.jeeMode ? "text-orange-400" : "text-white/60"}`}>{user.jeeMode ? "Enabled" : "Disabled"}</p>
                  </div>
                  <div>
                    <p className="text-white/40 text-xs">Subjects</p>
                    <p className="text-white font-medium">{user.scholarClass === 11 ? "Physics, Chemistry, Maths, CS, English" : "Maths, Science, SST, English, Hindi"}</p>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* ===== Appearance ===== */}
            <TabsContent value="appearance" className="mt-2 space-y-4">
              <div className="asme-glass rounded-3xl p-6" data-testid="developer-appearance-gate">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="mb-2 flex items-center gap-2">
                      <Palette className="h-4 w-4 text-violet-300" />
                      <h3 className="font-semibold text-white">Appearance &amp; Accessibility</h3>
                      <UiBadge className="border-violet-300/30 bg-violet-400/10 text-violet-200">Beta</UiBadge>
                    </div>
                    <p className="max-w-2xl text-sm leading-6 text-white/55">
                      Font controls remain available to everyone. Scholar Plus adds advanced density and contrast controls without replacing Scholar's original backgrounds.
                    </p>
                  </div>
                  {!appearanceUnlocked ? (
                    <Button type="button" variant="outline" className="border-white/15 bg-white/5 text-white" onClick={() => window.dispatchEvent(new CustomEvent("neha-scholar:navigate", { detail: { viewId: "plus" } }))}>
                      <Lock className="mr-2 h-4 w-4" />View Scholar Plus
                    </Button>
                  ) : <UiBadge className="bg-emerald-500/15 text-emerald-200">Advanced controls unlocked</UiBadge>}
                </div>
                <div className="mt-5 grid gap-4 border-t border-white/10 pt-5 sm:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/45">Font size</label>
                      <Select value={settings.fontScale} onValueChange={(value) => {
                        const fontScale = value as "90" | "100" | "110" | "120";
                        updateSettings({ fontScale });
                        document.documentElement.dataset.fontScale = fontScale;
                      }}>
                        <SelectTrigger className="asme-glass-input"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="90">Small</SelectItem><SelectItem value="100">Original</SelectItem><SelectItem value="110">Large</SelectItem><SelectItem value="120">Extra large</SelectItem></SelectContent>
                      </Select>
                    </div>
                    <GlassSettingRow icon={<BookOpen className="h-4 w-4 text-white/70" />} title="Readable font" desc="Use Scholar's accessible sans-serif font.">
                      <Switch checked={settings.readableFont} onCheckedChange={(readableFont) => {
                        updateSettings({ readableFont });
                        document.documentElement.dataset.readableFont = String(readableFont);
                      }} />
                    </GlassSettingRow>
                    {appearanceUnlocked ? <>
                      <div>
                        <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/45">Interface density · Plus</label>
                        <Select value={settings.density} onValueChange={(value) => {
                          const density = value as "compact" | "comfortable" | "spacious";
                          updateSettings({ density });
                          document.documentElement.dataset.density = density;
                        }}>
                          <SelectTrigger className="asme-glass-input"><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="compact">Compact</SelectItem><SelectItem value="comfortable">Comfortable</SelectItem><SelectItem value="spacious">Spacious</SelectItem></SelectContent>
                        </Select>
                      </div>
                      <GlassSettingRow icon={<Eye className="h-4 w-4 text-white/70" />} title="High contrast · Plus" desc="Strengthen surface and text contrast while preserving page backgrounds.">
                        <Switch checked={settings.highContrast} onCheckedChange={(highContrast) => {
                          updateSettings({ highContrast });
                          document.documentElement.dataset.highContrast = String(highContrast);
                        }} />
                      </GlassSettingRow>
                    </> : null}
                    <Button type="button" variant="outline" className="sm:col-span-2 border-white/15 bg-white/5 text-white" onClick={() => {
                      updateSettings({ fontScale: "100", readableFont: false, density: "comfortable", highContrast: false });
                      document.documentElement.dataset.fontScale = "100";
                      document.documentElement.dataset.readableFont = "false";
                      document.documentElement.dataset.density = "comfortable";
                      document.documentElement.dataset.highContrast = "false";
                      toast.success("Original Scholar typography restored");
                    }}>Restore original font</Button>
                  </div>
              </div>

              <div className="asme-glass rounded-3xl p-6" data-testid="startup-loading-settings">
                <div className="mb-4">
                  <h3 className="flex items-center gap-2 font-semibold text-white">
                    <Gauge className="h-4 w-4 text-cyan-300" />
                    Startup Loading
                  </h3>
                  <p className="mt-1 text-sm text-white/50">
                    Choose how thoroughly Scholar prepares routes, media and study tools before opening.
                  </p>
                </div>
                <div
                  className="grid gap-3 sm:grid-cols-2"
                  role="radiogroup"
                  aria-label="Startup loading mode"
                >
                  {(Object.keys(STARTUP_MODE_DEFINITIONS) as StartupLoadingMode[]).map((mode) => {
                    const option = STARTUP_MODE_DEFINITIONS[mode];
                    const selected = (settings.startupLoadingMode ?? "long") === mode;
                    return (
                      <button
                        key={mode}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => {
                          updateSettings({ startupLoadingMode: mode });
                          toast.success(`${option.label} startup selected`, {
                            description: "The change applies the next time Scholar opens.",
                          });
                        }}
                        className={cn(
                          "rounded-2xl border p-4 text-left transition-colors",
                          selected
                            ? "border-cyan-300/45 bg-cyan-300/[0.09] shadow-[inset_0_1px_rgba(255,255,255,.08),0_0_24px_rgba(34,211,238,.08)]"
                            : "border-white/10 bg-white/[0.035] hover:border-white/20 hover:bg-white/[0.06]",
                        )}
                      >
                        <span className="flex items-center justify-between gap-3">
                          <span className="text-sm font-semibold text-white">{option.label}</span>
                          {option.badge ? (
                            <span
                              className={cn(
                                "rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider",
                                option.badge === "Recommended"
                                  ? "border-violet-300/30 bg-violet-400/10 text-violet-200"
                                  : option.badge === "Default"
                                    ? "border-cyan-300/30 bg-cyan-400/10 text-cyan-200"
                                    : "border-white/15 bg-white/5 text-white/55",
                              )}
                            >
                              {option.badge}
                            </span>
                          ) : null}
                        </span>
                        <span className="mt-2 block text-xs leading-5 text-white/50">
                          {option.description}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-4 text-xs leading-5 text-white/40">
                  Loading time varies depending on your device, connection and cached content. Full Loading
                  adapts automatically on mobile and data-saving connections.
                </p>
              </div>

              <div className="asme-glass rounded-3xl p-6">
                <h3 className="font-semibold text-white mb-2">General interface behaviour</h3>
                <div className="divide-y divide-white/10">
                <GlassSettingRow icon={<BookOpen className="h-4 w-4 text-white/70" />} title="Sidebar on startup" desc="Remember its last state, or always open or close it.">
                  <Select value={settings.sidebarBehavior ?? "remember"} onValueChange={(v) => updateSettings({ sidebarBehavior: v as "remember" | "open" | "closed" })}>
                    <SelectTrigger aria-label="Sidebar on startup" className="w-32 asme-glass-input"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="remember">Remember</SelectItem>
                      <SelectItem value="open">Always open</SelectItem>
                      <SelectItem value="closed">Always closed</SelectItem>
                    </SelectContent>
                  </Select>
                </GlassSettingRow>
                <GlassSettingRow icon={<Star className="h-4 w-4 text-white/70" />} title="Sound Effects" desc="Play subtle sounds for actions and rewards.">
                  <Switch checked={settings.sound} onCheckedChange={(v) => updateSettings({ sound: v })} />
                </GlassSettingRow>
                <GlassSettingRow icon={<Trophy className="h-4 w-4 text-white/70" />} title="Auto-Archive Completed" desc="Automatically archive finished tasks & quizzes.">
                  <Switch checked={settings.autoArchive} onCheckedChange={(v) => updateSettings({ autoArchive: v })} />
                </GlassSettingRow>
                </div>
              </div>

              <div className="asme-glass rounded-3xl p-6">
                <div className="mb-2">
                  <h3 className="flex items-center gap-2 font-semibold text-white"><Volume2 className="h-4 w-4 text-indigo-300" /> Cinematic transition sound</h3>
                  <p className="mt-1 text-sm text-white/50">Used only for the successful-login introduction and Class 9 ↔ Class 11 academic switch.</p>
                </div>
                <div className="divide-y divide-white/10">
                  <GlassSettingRow icon={<Volume2 className="h-4 w-4 text-white/70" />} title="Transition music" desc="Allow the 16-second cinematic music segment during approved transitions.">
                    <Switch aria-label="Transition music" checked={settings.transitionMusic !== false} onCheckedChange={(value) => updateSettings({ transitionMusic: value })} />
                  </GlassSettingRow>
                  <GlassSettingRow icon={<Volume2 className="h-4 w-4 text-white/70" />} title="Transition volume" desc="Set the music level used for both transition types.">
                    <div className="flex w-48 items-center gap-3">
                      <Slider aria-label="Transition volume" disabled={settings.transitionMusic === false} min={0} max={100} step={5} value={[settings.transitionVolume ?? 65]} onValueChange={([value]) => updateSettings({ transitionVolume: value })} />
                      <span className="w-10 text-right text-xs tabular-nums text-white/60">{settings.transitionVolume ?? 65}%</span>
                    </div>
                  </GlassSettingRow>
                  <GlassSettingRow icon={<Sparkles className="h-4 w-4 text-white/70" />} title="Login-intro music" desc="Play once per session after a successful login, during the Scholar intro.">
                    <Switch aria-label="Login intro music" disabled={settings.transitionMusic === false} checked={settings.loginIntroMusic !== false} onCheckedChange={(value) => updateSettings({ loginIntroMusic: value })} />
                  </GlassSettingRow>
                  <GlassSettingRow icon={<GraduationCap className="h-4 w-4 text-white/70" />} title="Academic-switch music" desc="Play when switching Class 9 and Class 11 from Academic settings.">
                    <Switch aria-label="Academic switch music" disabled={settings.transitionMusic === false} checked={settings.academicSwitchMusic !== false} onCheckedChange={(value) => updateSettings({ academicSwitchMusic: value })} />
                  </GlassSettingRow>
                </div>
              </div>
            </TabsContent>

            {/* ===== Notifications ===== */}
            <TabsContent value="notifications" className="mt-2 space-y-4">
              <div className="asme-glass rounded-3xl p-6">
                <div className="mb-5">
                  <h3 className="flex items-center gap-2 font-semibold text-white"><SlidersHorizontal className="h-4 w-4 text-cyan-300" />Notification customizer</h3>
                  <p className="mt-1 text-sm text-white/50">Adjust Scholar's liquid-glass notification size, desktop position and display time. Mobile notifications always stay at the top.</p>
                </div>
                <div className="space-y-6">
                  <div><div className="mb-2 flex justify-between text-sm text-white/75"><span>Size</span><span>{settings.notificationSize ?? 100}%</span></div><Slider aria-label="Notification size" min={75} max={125} step={5} value={[settings.notificationSize ?? 100]} onValueChange={([notificationSize]) => updateSettings({ notificationSize })} /></div>
                  <div><label className="mb-2 block text-sm text-white/75">Desktop position</label><Select value={settings.notificationPosition ?? "top-left"} onValueChange={(notificationPosition) => updateSettings({ notificationPosition: notificationPosition as typeof settings.notificationPosition })}><SelectTrigger className="asme-glass-input"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="top-left">Top left</SelectItem><SelectItem value="top-right">Top right</SelectItem><SelectItem value="top-center">Top center</SelectItem><SelectItem value="bottom-left">Bottom left</SelectItem><SelectItem value="bottom-right">Bottom right</SelectItem><SelectItem value="bottom-center">Bottom center</SelectItem></SelectContent></Select></div>
                  <div><div className="mb-2 flex justify-between text-sm text-white/75"><span>Timeout</span><span>{((settings.notificationTimeout ?? 2000) / 1000).toFixed(1)} seconds</span></div><Slider aria-label="Notification timeout" min={1500} max={10000} step={500} value={[settings.notificationTimeout ?? 2000]} onValueChange={([notificationTimeout]) => updateSettings({ notificationTimeout })} /></div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><p className="text-xs text-white/50">Preview uses the current values immediately.</p><Button type="button" className="mt-3 bg-cyan-500 text-slate-950 hover:bg-cyan-400" onClick={() => toast.success("Notification preview", { description: "This is how completion messages will appear across Scholar." })}><Bell className="mr-2 h-4 w-4" />Show preview</Button></div>
                </div>
              </div>
            </TabsContent>

            {/* ===== Update Logs ===== */}
            <TabsContent value="updates" className="mt-2 space-y-4">
              <div className="asme-glass rounded-3xl p-6">
                <div className="mb-5"><h3 className="flex items-center gap-2 font-semibold text-white"><History className="h-4 w-4 text-violet-300" />Scholar update logs</h3><p className="mt-1 text-sm text-white/50">Every Scholar release, including minor fixes, is recorded here from this update onward.</p></div>
                <div className="space-y-4">{SCHOLAR_UPDATE_LOG.map((release) => <article key={release.version} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-semibold text-white">{release.title}</p><p className="text-xs text-white/40">{release.date}</p></div><UiBadge variant="outline" className="border-violet-300/25 text-violet-200">{release.version}</UiBadge></div><ul className="mt-3 space-y-1.5 text-sm text-white/65">{release.items.map((item) => <li key={item} className="flex gap-2"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-300" />{item}</li>)}</ul></article>)}</div>
              </div>
            </TabsContent>

            {/* ===== LAM ===== */}
            <TabsContent value="lam" className="mt-2 space-y-4">
              <LamIdentitySettings />
              <UserAISettings />
              <div className="asme-glass rounded-3xl p-6">
                <GlassSettingRow icon={<Bot className="h-4 w-4 text-cyan-300" />} title="Mobile LAM" desc="Choose whether LAM is absent, compact, or fully available on mobile. Off stops wake listening and idle effects.">
                  <Select value={settings.mobileLamMode ?? "off"} onValueChange={(value) => updateSettings({ mobileLamMode: value as "off" | "compact" | "full" })}><SelectTrigger aria-label="Mobile LAM mode" className="w-32 asme-glass-input"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="off">Off</SelectItem><SelectItem value="compact">Compact</SelectItem><SelectItem value="full">Full</SelectItem></SelectContent></Select>
                </GlassSettingRow>
              </div>
              <div className="asme-glass rounded-3xl p-6 text-sm leading-6 text-white/58">
                E-Books now use the same LAM assistant as the rest of Scholar. LAM automatically receives the active book, chapter, page number, and available page text—there is no separate E-Book assistant to configure.
              </div>

              <div className="asme-glass rounded-3xl p-6">
                <GlassSettingRow icon={<Bot className="h-4 w-4 text-cyan-300" />} title="Show LAM" desc="Show the floating LAM capsule. Hands-Free wake listening can remain available while the capsule is hidden.">
                  <Switch aria-label="Enable LAM" checked={lamPreferences.assistantEnabled} onCheckedChange={(value) => {
                    updateLam({ assistantEnabled: value });
                    toast.success(value ? "LAM shown" : "LAM hidden", { description: value ? "The assistant capsule is available again." : lamPreferences.wakeWordEnabled ? "Say “Hey LAM” to reveal it while Scholar is active." : "The assistant capsule is now hidden." });
                  }} />
                </GlassSettingRow>
              </div>

              <div className="asme-glass rounded-3xl p-6">
                <div className="mb-3"><h3 className="font-semibold text-white flex items-center gap-2"><Mic className="h-4 w-4 text-cyan-300" />Voice activation</h3><p className="mt-1 text-sm text-white/50">Voice settings are isolated to {user.name}’s Class {user.scholarClass} profile. Browser permission is requested only when you enable wake activation or press the microphone.</p></div>
                <div className="divide-y divide-white/10">
                  <GlassSettingRow icon={<Mic className="h-4 w-4 text-white/70" />} title="Hands-Free “Hey LAM”" desc="Manually enable foreground wake-phrase listening for Hey LAM and Okay LAM."><Switch aria-label="Hands-Free Hey LAM" disabled={!lamPreferences.voiceInputEnabled} checked={lamPreferences.wakeWordEnabled} onCheckedChange={(value) => void setHandsFreeLam(value)} /></GlassSettingRow>
                  <GlassSettingRow icon={<Mic className="h-4 w-4 text-white/70" />} title="Input device" desc="Speech recognition uses the browser’s selected default microphone."><span className="text-xs text-white/55">Browser default</span></GlassSettingRow>
                  <GlassSettingRow icon={<MessageCircle className="h-4 w-4 text-white/70" />} title="Recognition language" desc="Language and regional accent used for live speech recognition."><Select value={lamPreferences.voiceLanguage} onValueChange={(value) => updateLam({ voiceLanguage: value as LamPreferences["voiceLanguage"] })}><SelectTrigger aria-label="LAM recognition language" className="w-40 asme-glass-input"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="en-IN">English (India)</SelectItem><SelectItem value="en-US">English (US)</SelectItem><SelectItem value="en-GB">English (UK)</SelectItem></SelectContent></Select></GlassSettingRow>
                  <div className="rounded-2xl bg-cyan-400/8 p-4 text-xs leading-5 text-cyan-50/75">“Hey LAM” works while Scholar is open and active. Mobile browsers may stop listening when Scholar is backgrounded or the screen is locked.</div>
                </div>
              </div>

              <div className="asme-glass rounded-3xl p-6">
                <h3 className="font-semibold text-white flex items-center gap-2 mb-2"><Volume2 className="h-4 w-4 text-violet-300" />Voice response</h3>
                <div className="divide-y divide-white/10">
                  <GlassSettingRow icon={<Volume2 className="h-4 w-4 text-white/70" />} title="Spoken replies" desc="Read completed LAM answers aloud with browser speech synthesis."><Switch checked={lamPreferences.voiceRepliesEnabled} onCheckedChange={(value) => updateLam({ voiceRepliesEnabled: value })} /></GlassSettingRow>
                  <GlassSettingRow icon={<Volume2 className="h-4 w-4 text-white/70" />} title="Speech speed" desc={`${lamPreferences.speechRate.toFixed(1)}×`}><Slider className="w-32" min={0.6} max={1.6} step={0.1} value={[lamPreferences.speechRate]} onValueChange={([value]) => updateLam({ speechRate: value })} /></GlassSettingRow>
                  <GlassSettingRow icon={<Volume2 className="h-4 w-4 text-white/70" />} title="Speech pitch" desc={lamPreferences.speechPitch.toFixed(1)}><Slider className="w-32" min={0.6} max={1.5} step={0.1} value={[lamPreferences.speechPitch]} onValueChange={([value]) => updateLam({ speechPitch: value })} /></GlassSettingRow>
                  <GlassSettingRow icon={<Volume2 className="h-4 w-4 text-white/70" />} title="Volume" desc={`${Math.round(lamPreferences.speechVolume * 100)}%`}><Slider className="w-32" min={0} max={1} step={0.1} value={[lamPreferences.speechVolume]} onValueChange={([value]) => updateLam({ speechVolume: value })} /></GlassSettingRow>
                  <GlassSettingRow icon={<Volume2 className="h-4 w-4 text-white/70" />} title="Preferred voice" desc="Choose a voice installed by your browser or device."><Select value={lamPreferences.selectedVoice || "system"} onValueChange={(value) => updateLam({ selectedVoice: value === "system" ? "" : value })}><SelectTrigger aria-label="LAM preferred voice" className="w-48 asme-glass-input"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="system">System default</SelectItem>{speechVoices.map((voice) => <SelectItem key={voice.voiceURI} value={voice.name}>{voice.name} · {voice.lang}</SelectItem>)}</SelectContent></Select></GlassSettingRow>
                  <button onClick={() => { if (!("speechSynthesis" in window)) return toast.error("Speech synthesis is unavailable"); window.speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance("Hi, I’m LAM. Your voice settings are working."); utterance.rate = lamPreferences.speechRate; utterance.pitch = lamPreferences.speechPitch; utterance.volume = lamPreferences.speechVolume; window.speechSynthesis.speak(utterance); }} className="mt-4 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs text-white hover:bg-white/10">Test voice</button>
                </div>
              </div>

              <div className="asme-glass rounded-3xl p-6">
                <h3 className="font-semibold text-white flex items-center gap-2 mb-2"><Brain className="h-4 w-4 text-emerald-300" />Conversation, memory & appearance</h3>
                <div className="divide-y divide-white/10">
                  <GlassSettingRow icon={<MessageCircle className="h-4 w-4 text-white/70" />} title="Follow-up listening" desc="Allow a visible follow-up listening window after a voice reply."><Switch checked={lamPreferences.followUpListeningEnabled} onCheckedChange={(value) => updateLam({ followUpListeningEnabled: value })} /></GlassSettingRow>
                  <GlassSettingRow icon={<Mic className="h-4 w-4 text-white/70" />} title="Voice input" desc="Allow push-to-talk and browser speech recognition inside LAM."><Switch aria-label="LAM voice input" checked={lamPreferences.voiceInputEnabled} onCheckedChange={(value) => updateLam({ voiceInputEnabled: value, ...(value ? {} : { wakeWordEnabled: false }) })} /></GlassSettingRow>
                  <GlassSettingRow icon={<Brain className="h-4 w-4 text-white/70" />} title="Study memory" desc="Allow explicit learning preferences to be saved for this profile."><Switch checked={lamPreferences.studyMemoryEnabled} onCheckedChange={(value) => updateLam({ studyMemoryEnabled: value })} /></GlassSettingRow>
                  <GlassSettingRow icon={<Eye className="h-4 w-4 text-white/70" />} title="Use current-screen context" desc="Attach only structured information from the active Scholar view—not the whole DOM."><Switch aria-label="Use current-screen context" checked={lamPreferences.currentScreenContext} onCheckedChange={(value) => updateLam({ currentScreenContext: value })} /></GlassSettingRow>
                  <GlassSettingRow icon={<GraduationCap className="h-4 w-4 text-white/70" />} title="Use study progress" desc="Let LAM include stored weak-topic signals when they are relevant."><Switch aria-label="Use study progress" checked={lamPreferences.studyHistoryEnabled} onCheckedChange={(value) => updateLam({ studyHistoryEnabled: value })} /></GlassSettingRow>
                  <GlassSettingRow icon={<Trophy className="h-4 w-4 text-white/70" />} title="Use quiz history" desc="Let LAM include the most recent stored quiz result."><Switch aria-label="Use quiz history" checked={lamPreferences.quizHistoryEnabled} onCheckedChange={(value) => updateLam({ quizHistoryEnabled: value })} /></GlassSettingRow>
                  <GlassSettingRow icon={<History className="h-4 w-4 text-white/70" />} title="Save conversations" desc="Keep LAM conversations for this academic profile. Turn off for session-only chat."><Switch aria-label="Save LAM conversations" checked={lamPreferences.saveConversations} onCheckedChange={(value) => updateLam({ saveConversations: value })} /></GlassSettingRow>
                  <GlassSettingRow icon={<Sparkles className="h-4 w-4 text-white/70" />} title="Compact orb" desc="Show only the floating LAM orb without its text label."><Switch aria-label="Compact orb" checked={lamPreferences.compactOrb} onCheckedChange={(value) => updateLam({ compactOrb: value })} /></GlassSettingRow>
                  <GlassSettingRow icon={<Eye className="h-4 w-4 text-white/70" />} title="Reduce transparency" desc="Use a solid high-legibility panel instead of background blur."><Switch checked={lamPreferences.reduceTransparency} onCheckedChange={(value) => updateLam({ reduceTransparency: value })} /></GlassSettingRow>
                  <GlassSettingRow icon={<Sparkles className="h-4 w-4 text-white/70" />} title="Proactive assistance" desc="Control optional suggestions; LAM never interrupts active exams."><Select value={lamPreferences.proactiveMode} onValueChange={(value) => updateLam({ proactiveMode: value as LamPreferences["proactiveMode"] })}><SelectTrigger className="w-36 asme-glass-input"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="off">Off</SelectItem><SelectItem value="important">Important only</SelectItem><SelectItem value="normal">Normal</SelectItem></SelectContent></Select></GlassSettingRow>
                  <GlassSettingRow icon={<Sparkles className="h-4 w-4 text-white/70" />} title="Animation intensity" desc="Choose how strongly the capsule morphs and reflects light."><Select value={lamPreferences.animationIntensity} onValueChange={(value) => updateLam({ animationIntensity: value as LamPreferences["animationIntensity"] })}><SelectTrigger aria-label="LAM animation intensity" className="w-36 asme-glass-input"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="minimal">Minimal</SelectItem><SelectItem value="balanced">Balanced</SelectItem><SelectItem value="expressive">Expressive</SelectItem></SelectContent></Select></GlassSettingRow>
                  <GlassSettingRow icon={<MessageCircle className="h-4 w-4 text-white/70" />} title="Preferred response detail" desc="Control the default depth of academic answers."><Select value={lamPreferences.responseDetail} onValueChange={(value) => updateLam({ responseDetail: value as LamPreferences["responseDetail"] })}><SelectTrigger aria-label="LAM response detail" className="w-44 asme-glass-input"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="quick">Quick</SelectItem><SelectItem value="balanced">Balanced</SelectItem><SelectItem value="detailed">Detailed</SelectItem><SelectItem value="step-by-step">Teach step by step</SelectItem></SelectContent></Select></GlassSettingRow>
                  <GlassSettingRow icon={<Zap className="h-4 w-4 text-white/70" />} title="Keyboard shortcut" desc="Open LAM without leaving the current screen."><Select value={lamPreferences.keyboardShortcut} onValueChange={(value) => updateLam({ keyboardShortcut: value as LamPreferences["keyboardShortcut"] })}><SelectTrigger aria-label="LAM keyboard shortcut" className="w-44 asme-glass-input"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ctrl-space">Ctrl/⌘ + Space</SelectItem><SelectItem value="alt-space">Alt + Space</SelectItem><SelectItem value="ctrl-shift-l">Ctrl/⌘ + Shift + L</SelectItem></SelectContent></Select></GlassSettingRow>
                </div>
              </div>

              <div className="asme-glass rounded-3xl p-6">
                <h3 className="font-semibold text-white flex items-center gap-2 mb-2"><Zap className="h-4 w-4 text-fuchsia-300" />Custom Commands <span className="rounded-full border border-cyan-300/25 bg-cyan-400/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-cyan-200">LAM × FICA</span></h3>
                <p className="mb-3 text-sm text-white/50">Create your own phrases that trigger approved Scholar actions — reminders, focus sessions, templates and exam rescue plans. Commands never run your own code.</p>
                <CustomCommandsPanel scholarClass={user.scholarClass} />
              </div>

              <div className="asme-glass rounded-3xl p-6"><h3 className="font-semibold text-white">Privacy controls</h3><p className="mt-1 text-sm text-white/50">Clearing LAM removes conversations, preferences, memory, and action history for this Class {user.scholarClass} profile only. Scholar notes created through LAM remain in Notes.</p><button onClick={() => { if (!window.confirm(`Clear all LAM data for ${user.name}'s Class ${user.scholarClass} profile?`)) return; clearLamProfile(lamProfileId); setLamPreferences(loadLamState(lamProfileId).preferences); toast.success("LAM profile data cleared"); }} className="mt-4 rounded-full border border-rose-300/25 bg-rose-500/10 px-4 py-2 text-xs font-semibold text-rose-100 hover:bg-rose-500/20">Clear this profile’s LAM data</button></div>
            </TabsContent>

            {/* ===== Privacy ===== */}
            <TabsContent value="privacy" className="mt-2 space-y-4">
              <div className="asme-glass rounded-3xl p-6">
                <div className="mb-2"><h3 className="font-semibold text-white flex items-center gap-2"><Globe className="h-4 w-4 text-indigo-300" />Profile & discovery</h3><p className="mt-1 text-sm text-white/50">Choose what other Scholar users may see and how they can find you.</p></div>
                <div className="divide-y divide-white/10">
                <GlassSettingRow icon={<Trophy className="h-4 w-4 text-white/70" />} title="Show me on leaderboards" desc="Let classmates see your XP rank.">
                  <Switch aria-label="Show me on leaderboards" checked={settings.leaderboard ?? true} onCheckedChange={(v) => { updateSettings({ leaderboard: v }); toast.success("Privacy updated"); }} />
                </GlassSettingRow>
                <GlassSettingRow icon={<User className="h-4 w-4 text-white/70" />} title="Show online status" desc="Let friends see when you are active in Scholar.">
                  <Switch aria-label="Show online status" checked={settings.showOnlineStatus ?? true} onCheckedChange={(v) => updateSettings({ showOnlineStatus: v })} />
                </GlassSettingRow>
                <GlassSettingRow icon={<BookOpen className="h-4 w-4 text-white/70" />} title="Share study activity" desc="Show completed lessons and study milestones on your profile.">
                  <Switch aria-label="Share study activity" checked={settings.shareStudyActivity ?? true} onCheckedChange={(v) => updateSettings({ shareStudyActivity: v })} />
                </GlassSettingRow>
                <GlassSettingRow icon={<Eye className="h-4 w-4 text-white/70" />} title="Profile visibility" desc="Who can see your study activity.">
                  <Select value={settings.profileVisibility ?? "friends"} onValueChange={(v) => { updateSettings({ profileVisibility: v as "public" | "friends" | "private" }); toast.success("Privacy updated"); }}>
                    <SelectTrigger aria-label="Profile visibility" className="w-32 asme-glass-input"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="public">Public</SelectItem>
                      <SelectItem value="friends">Friends</SelectItem>
                      <SelectItem value="private">Private</SelectItem>
                    </SelectContent>
                  </Select>
                </GlassSettingRow>
                </div>
              </div>

              <div className="asme-glass rounded-3xl p-6">
                <div className="mb-2"><h3 className="font-semibold text-white flex items-center gap-2"><MessageCircle className="h-4 w-4 text-pink-300" />Communication</h3><p className="mt-1 text-sm text-white/50">Manage who may contact you through Scholar.</p></div>
                <div className="divide-y divide-white/10">
                  <GlassSettingRow icon={<MessageCircle className="h-4 w-4 text-white/70" />} title="Allow community messages" desc="Send and receive friend messages and community replies.">
                    <Switch aria-label="Allow community messages" checked={settings.communityMessages ?? true} onCheckedChange={(v) => { updateSettings({ communityMessages: v }); toast.success(v ? "Community messages enabled" : "Community messages disabled"); }} />
                  </GlassSettingRow>
                  <GlassSettingRow icon={<User className="h-4 w-4 text-white/70" />} title="Allow friend requests" desc="Let people send you new friend requests.">
                    <Switch aria-label="Allow friend requests" checked={settings.allowFriendRequests ?? true} onCheckedChange={(v) => updateSettings({ allowFriendRequests: v })} />
                  </GlassSettingRow>
                </div>
              </div>

              <div className="asme-glass rounded-3xl p-6">
                <div className="mb-2"><h3 className="font-semibold text-white flex items-center gap-2"><Bot className="h-4 w-4 text-cyan-300" />LAM & AI privacy</h3><p className="mt-1 text-sm text-white/50">Control the information included with requests to the server-side Groq assistant. API keys always remain on the server.</p></div>
                <div className="divide-y divide-white/10">
                  <GlassSettingRow icon={<GraduationCap className="h-4 w-4 text-white/70" />} title="Include profile name in AI" desc="Send your display name and active class so LAM can personalize replies.">
                    <Switch aria-label="Include profile name in AI" checked={settings.includeProfileInAI ?? true} onCheckedChange={(v) => updateSettings({ includeProfileInAI: v })} />
                  </GlassSettingRow>
                  <GlassSettingRow icon={<BookOpen className="h-4 w-4 text-white/70" />} title="Share current page with LAM" desc="Include the active subject, chapter, book, and page with a LAM request.">
                    <Switch aria-label="Share current page with LAM" checked={settings.lamPageContext ?? true} onCheckedChange={(v) => updateSettings({ lamPageContext: v })} />
                  </GlassSettingRow>
                  <GlassSettingRow icon={<Eye className="h-4 w-4 text-white/70" />} title="Share selected text with LAM" desc="Attach text you select on a Scholar page to your next LAM request.">
                    <Switch aria-label="Share selected text with LAM" checked={settings.lamSelectedText ?? true} onCheckedChange={(v) => updateSettings({ lamSelectedText: v })} />
                  </GlassSettingRow>
                </div>
                <div className="mt-4 rounded-2xl border border-cyan-300/10 bg-cyan-300/5 p-4 text-xs leading-5 text-white/55"><Lock className="mr-1.5 inline h-3.5 w-3.5 text-cyan-300" />LAM sends only the current request, recent conversation messages, and context enabled above. It does not send your complete Scholar database.</div>
              </div>
            </TabsContent>

            {/* ===== Data ===== */}
            <TabsContent value="data" className="mt-2 space-y-4">
              <div className="asme-glass rounded-3xl p-6 space-y-4">
                <div>
                  <h3 className="font-semibold flex items-center gap-2 text-white">
                    <Database className="h-4 w-4 text-white/70" /> Backup & Restore
                  </h3>
                  <p className="text-sm text-white/50 mt-1">Export your entire study data as JSON, or restore from a backup file.</p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button onClick={exportData} className="asme-glass rounded-full px-5 py-2 text-white text-sm font-medium hover:bg-white/5 transition-colors flex items-center gap-1.5">
                    <Download className="h-3.5 w-3.5" /> Export all data
                  </button>
                  <button onClick={() => importRef.current?.click()} className="asme-glass rounded-full px-5 py-2 text-white text-sm font-medium hover:bg-white/5 transition-colors flex items-center gap-1.5">
                    <Upload className="h-3.5 w-3.5" /> Import data
                  </button>
                  <input ref={importRef} type="file" accept="application/json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) importData(f); e.target.value = ""; }} />
                </div>
              </div>

              <div className="asme-glass rounded-3xl p-6 space-y-4">
                <div>
                  <h3 className="font-semibold flex items-center gap-2 text-white">
                    <Trash2 className="h-4 w-4 text-white/70" /> Reset Specific Data
                  </h3>
                  <p className="text-sm text-white/50 mt-1">Clear a single module without touching the rest.</p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {RESET_PARTS.map((p) => (
                    <button key={p.key} onClick={() => { resetPart(p.key); toast.success(`${p.label} cleared`); }} className="asme-glass rounded-2xl px-3 py-2.5 text-white text-xs font-medium hover:bg-white/5 transition-colors flex items-center justify-center gap-1.5">
                      <span>{p.icon}</span> {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="asme-glass rounded-3xl p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="font-semibold text-white">Reset Everything</h3>
                    <p className="text-sm text-white/50 mt-1">Restore Scholar to its initial state to its initial seeded state. This cannot be undone.</p>
                  </div>
                  <ResetEverythingDialog onConfirm={() => { resetEverything(); toast.success("Everything reset"); }} />
                </div>
              </div>
            </TabsContent>

            {/* ===== Developer ===== */}
            <TabsContent value="developer" className="mt-2 space-y-4">
              <div className="asme-glass rounded-3xl p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-amber-400">{developerAuthorized ? "Developer Mode Active" : "Developer authorization required"}</p>
                    <p className="text-sm text-white/50 mt-0.5">{developerAuthorized ? "These controls let you manipulate game state, XP, coins and more. They will affect your real progress — use responsibly." : "Developer controls are protected by a signed, expiring server session. A browser toggle or localStorage edit cannot unlock them."}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-medium text-amber-400 hidden sm:inline">{developerAuthorized ? "ON" : "OFF"}</span>
                    <Switch
                      checked={developerAuthorized}
                      onCheckedChange={(v) => {
                        if (v) {
                          setShowDevPassword(true);
                        } else {
                          void fetch("/api/developer/session", { method: "DELETE" }).finally(() => window.dispatchEvent(new Event("scholar:session-changed")));
                          toast.success("Dev mode disabled");
                        }
                      }}
                    />
                  </div>
                </div>
              </div>

              {developerAuthorized ? <>
              <div className="asme-glass rounded-3xl p-6 space-y-4">
                <h3 className="font-semibold flex items-center gap-2 text-white">
                  <Coins className="h-4 w-4 text-white/70" /> Resource Controls
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <GlassDevNumberInput label="Coins" icon={<Coins className="h-3.5 w-3.5 text-white/70" />} value={coinInput} onChange={setCoinInput} presets={[{ label: "+1,000", onClick: () => applyCoins(coins + 1000) }, { label: "Max 99,999", onClick: () => applyCoins(99999) }, { label: "0", onClick: () => applyCoins(0) }]} onApply={() => applyCoins(Math.max(0, parseInt(coinInput) || 0))} />
                  <GlassDevNumberInput label="XP" icon={<Zap className="h-3.5 w-3.5 text-white/70" />} value={xpInput} onChange={setXpInput} presets={[{ label: "+1,000", onClick: () => applyXP(xp + 1000) }, { label: "Max 99,999", onClick: () => applyXP(99999) }, { label: "0", onClick: () => applyXP(0) }]} onApply={() => applyXP(Math.max(0, parseInt(xpInput) || 0))} />
                  <GlassDevNumberInput label="Level" icon={<Star className="h-3.5 w-3.5 text-white/70" />} value={lvlInput} onChange={setLvlInput} presets={[{ label: "+1", onClick: () => applyLevel(getLevelInfo(xp).level + 1) }, { label: "20", onClick: () => applyLevel(20) }, { label: "1", onClick: () => applyLevel(1) }]} onApply={() => applyLevel(Math.max(1, parseInt(lvlInput) || 1))} />
                  <GlassDevNumberInput label="Streak" icon={<Flame className="h-3.5 w-3.5 text-white/70" />} value={streakInput} onChange={setStreakInput} presets={[{ label: "+7", onClick: () => applyStreak(streak + 7) }, { label: "365", onClick: () => applyStreak(365) }, { label: "0", onClick: () => applyStreak(0) }]} onApply={() => applyStreak(Math.max(0, parseInt(streakInput) || 0))} />
                </div>
              </div>

              <div className="asme-glass rounded-3xl p-6 space-y-4">
                <h3 className="font-semibold flex items-center gap-2 text-white">
                  <Trophy className="h-4 w-4 text-white/70" /> Subject Mastery
                </h3>
                <div className="space-y-5">
                  {SUBJECTS.map((s) => (
                    <div key={s.id}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-white flex items-center gap-2"><span>{s.icon}</span>{s.name}</span>
                        <span className="text-xs font-mono text-white/50 tabular-nums">{mastery[s.id] ?? 0}%</span>
                      </div>
                      <Slider value={[mastery[s.id] ?? 0]} onValueChange={([v]) => setMastery(s.id, v)} max={100} step={1} />
                    </div>
                  ))}
                </div>
              </div>

              <div className="asme-glass rounded-3xl p-6 space-y-4">
                <h3 className="font-semibold flex items-center gap-2 text-white">
                  <Gamepad2 className="h-4 w-4 text-white/70" /> Quick Actions
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <button onClick={doCompleteDailyChallenge} className="asme-glass rounded-2xl px-3 py-2.5 text-white text-xs font-medium hover:bg-white/5 transition-colors flex items-center justify-center gap-1.5"><Trophy className="h-3.5 w-3.5" /> Complete daily</button>
                  <button onClick={() => { addCoins(10000); toast.success("+10,000 coins"); }} className="asme-glass rounded-2xl px-3 py-2.5 text-white text-xs font-medium hover:bg-white/5 transition-colors flex items-center justify-center gap-1.5"><Coins className="h-3.5 w-3.5" /> +10,000 coins</button>
                  <button onClick={() => { addXP(5000); toast.success("+5,000 XP"); }} className="asme-glass rounded-2xl px-3 py-2.5 text-white text-xs font-medium hover:bg-white/5 transition-colors flex items-center justify-center gap-1.5"><Zap className="h-3.5 w-3.5" /> +5,000 XP</button>
                  <button onClick={() => applyLevel(getLevelInfo(xp).level + 5)} className="asme-glass rounded-2xl px-3 py-2.5 text-white text-xs font-medium hover:bg-white/5 transition-colors flex items-center justify-center gap-1.5"><Star className="h-3.5 w-3.5" /> +5 levels</button>
                  <button onClick={() => applyStreak(streak + 30)} className="asme-glass rounded-2xl px-3 py-2.5 text-white text-xs font-medium hover:bg-white/5 transition-colors flex items-center justify-center gap-1.5"><Flame className="h-3.5 w-3.5" /> +30 streak</button>
                </div>
              </div>

              <div className="asme-glass rounded-3xl p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="font-semibold text-white">Reset Everything</h3>
                    <p className="text-sm text-white/50 mt-1">Wipe all data and reseed.</p>
                  </div>
                  <ResetEverythingDialog onConfirm={() => { resetEverything(); toast.success("Everything reset"); }} />
                </div>
              </div>
              </> : <div className="asme-glass rounded-3xl p-6 text-center" data-testid="developer-controls-locked"><Lock className="mx-auto h-7 w-7 text-amber-300" /><h3 className="mt-3 font-semibold text-white">Developer controls are locked</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-white/50">Use the switch above and complete server verification. Privileged controls are not rendered until the signed session is confirmed.</p></div>}
            </TabsContent>
          </Tabs>
        </div>

        {/* Social icons footer */}
        <div className="relative z-10 flex justify-center gap-4 pb-12">
          {[
            { Icon: Instagram, label: "Instagram" },
            { Icon: Twitter, label: "Twitter" },
            { Icon: Globe, label: "Website" },
          ].map(({ Icon, label }) => (
            <button key={label} type="button" aria-label={label} onClick={() => toast.info(`${label} link is not configured yet`, { description: "No page was opened. Scholar will publish verified official links here when available." })} className="asme-glass rounded-full p-4 text-white/80 hover:text-white hover:bg-white/5 transition-all">
              <Icon size={20} className="h-5 w-5" />
            </button>
          ))}
        </div>
      </div>

      {/* Dev Mode Password Dialog */}
      <Dialog open={showDevPassword} onOpenChange={setShowDevPassword}>
        <DialogContent className="asme-glass rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Lock className="h-4 w-4 text-amber-400" /> Unlock Developer Mode
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-white/60">
            Dev mode lets you manipulate XP, coins, mastery and more. Enter the dev password to continue.
          </p>
          <Input
            type="password"
            value={devPasswordInput}
            onChange={(e) => setDevPasswordInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") confirmDevPassword(); }}
            placeholder="Enter dev password"
            className="asme-glass-input"
            autoFocus
          />
          <DialogFooter>
            <button
              onClick={() => { setShowDevPassword(false); setDevPasswordInput(""); }}
              className="asme-glass rounded-full px-5 py-2 text-white text-sm hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={confirmDevPassword}
              className="rounded-full px-5 py-2 text-white text-sm font-medium bg-amber-500/80 hover:bg-amber-500 transition-colors flex items-center gap-1.5"
            >
              <Lock className="h-3.5 w-3.5" /> Unlock
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function GlassField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-white/50">{label}</label>
      {children}
    </div>
  );
}

function GlassSettingRow({ icon, title, desc, children }: { icon: React.ReactNode; title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4 py-4 first:pt-0 last:pb-0">
      <div className="grid place-items-center h-9 w-9 rounded-lg bg-white/5 text-white/70 shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white">{title}</p>
        <p className="text-xs text-white/50">{desc}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function GlassDevNumberInput({ label, icon, value, onChange, presets, onApply }: { label: string; icon: React.ReactNode; value: string; onChange: (v: string) => void; presets: { label: string; onClick: () => void }[]; onApply: () => void }) {
  return (
    <div className="asme-glass rounded-2xl p-3 space-y-2">
      <span className="text-xs font-medium uppercase tracking-wider text-white/50 flex items-center gap-1.5">{icon}{label}</span>
      <div className="flex gap-2">
        <Input type="number" value={value} onChange={(e) => onChange(e.target.value)} className="asme-glass-input font-mono" />
        <button onClick={onApply} className="asme-glass rounded-full px-4 py-2 text-white text-xs font-medium hover:bg-white/5 transition-colors shrink-0">Apply</button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {presets.map((p) => (
          <button key={p.label} onClick={p.onClick} className="px-2 py-1 text-[10px] font-medium rounded-md bg-white/5 hover:bg-white/10 text-white/60 transition">{p.label}</button>
        ))}
      </div>
    </div>
  );
}

function ResetEverythingDialog({ onConfirm }: { onConfirm: () => void }) {
  const [open, setOpen] = useState(false);

  // Body scroll lock while the dialog is open. Radix already locks scroll for
  // the dialog content, but we add a belt-and-braces lock on the root
  // <html> so the page behind cannot scroll either.
  useEffect(() => {
    if (!open) return;
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => { document.documentElement.style.overflow = prev; };
  }, [open]);

  // Escape to close (Radix already does this, but we add a defensive handler
  // in case the Dialog is rendered inside a portal whose events are blocked).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="asme-glass rounded-full px-5 py-2 text-white text-sm font-medium hover:bg-white/5 transition-colors flex items-center gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" /> Reset
        </button>
      </DialogTrigger>
      <DialogContent
        // IMPORTANT: do NOT apply `asme-glass` here — that class sets
        // `position: relative`, which overrides the Dialog's `position: fixed`
        // centering transform and makes the dialog render inline at the bottom
        // of the settings page instead of centered over an overlay. We inline
        // the glass styling instead and bump z-index well above the mobile
        // bottom navigation (which is z-40).
        className="!fixed !left-1/2 !top-1/2 !z-[100] !-translate-x-1/2 !-translate-y-1/2 !w-[calc(100%-2rem)] !max-w-md !rounded-3xl !border !border-white/15 !p-6 !shadow-2xl"
        style={{
          background: "rgba(15, 15, 22, 0.92)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          color: "white",
        }}
      >
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div className="grid place-items-center h-10 w-10 rounded-xl bg-red-500/20 border border-red-500/30 text-red-300 shrink-0">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-white text-lg font-semibold leading-tight">
                Reset everything?
              </DialogTitle>
              <p className="text-xs text-white/50 mt-1">
                This action cannot be undone.
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 text-sm text-white/80 leading-relaxed">
          <p>
            Scholar will be wiped and restored to its initial seeded state. The
            following will be <span className="text-red-300 font-medium">permanently removed</span>:
          </p>
          <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs text-white/70 bg-white/[0.04] border border-white/10 rounded-xl p-3">
            <li className="flex items-center gap-1.5"><span className="text-red-300">✗</span> Notes & folders</li>
            <li className="flex items-center gap-1.5"><span className="text-red-300">✗</span> Flashcards & decks</li>
            <li className="flex items-center gap-1.5"><span className="text-red-300">✗</span> Tasks & reminders</li>
            <li className="flex items-center gap-1.5"><span className="text-red-300">✗</span> Quiz scores</li>
            <li className="flex items-center gap-1.5"><span className="text-red-300">✗</span> Focus sessions</li>
            <li className="flex items-center gap-1.5"><span className="text-red-300">✗</span> Uploaded files</li>
            <li className="flex items-center gap-1.5"><span className="text-red-300">✗</span> AI chat history</li>
            <li className="flex items-center gap-1.5"><span className="text-red-300">✗</span> Activity feed</li>
            <li className="flex items-center gap-1.5"><span className="text-red-300">✗</span> XP, coins & level</li>
            <li className="flex items-center gap-1.5"><span className="text-red-300">✗</span> Badges & streaks</li>
            <li className="flex items-center gap-1.5"><span className="text-red-300">✗</span> Subject mastery</li>
            <li className="flex items-center gap-1.5"><span className="text-red-300">✗</span> Custom settings</li>
          </ul>
          <p className="text-xs text-amber-300/80 flex items-start gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            Consider exporting your data first (Backup &amp; Restore → Export data) if you want to keep a copy.
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <button
            onClick={() => setOpen(false)}
            className="rounded-full px-5 py-2 text-white text-sm hover:bg-white/5 border border-white/10 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => { onConfirm(); setOpen(false); }}
            className="rounded-full px-5 py-2 text-white text-sm font-medium bg-red-600 hover:bg-red-500 transition-colors flex items-center gap-1.5 shadow-lg shadow-red-900/40"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Reset Everything
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
