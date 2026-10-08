# SEPB release matrix — 2026-10-06

Baseline: `5bab406`. Created before application edits. A route existing is not a pass.

Statuses: **Pending** = no current RC end-to-end proof; **Red** = reproduced failure; **Partial** = focused contracts/source evidence, not a complete live journey. Device columns initially pending; screenshots from earlier work do not certify this RC. “Local” means account-isolated browser storage, not promised cross-device sync. Auth/plan entries describe the existing code, including deliberately free early-beta access, not a newly imposed product policy.

| Feature | Status | Auth required? | Free / Plus? | Mobile | Desktop | Data persistence | Error state | Test coverage (existing; rerun pending) | Known issue / gate |
|---|---|---|---|---|---|---|---|---|---|
| Landing | Pending | No | Public | Pending | Pending | None | Global boundary | public-auth, startup | New RC browser pass |
| Sign Up | Pending | No | Free | Pending | Pending | PostgreSQL account | Validation/rate limit | auth-api, private-beta-auth | Isolated real account journey required |
| Sign In | Pending | No | Free | Pending | Pending | Server session cookie/hash | Friendly failure | auth-api, auth-recovery | Real refresh/logout/login required |
| Google login | Partial | OAuth | Free | Pending | Pending | Account/session | Callback failure redirect | google-auth, google-claims | RC-004; live callback unverified |
| Guest Mode | Partial | No | Limited local | Pending | Pending | Guest browser workspace | Private-feature gate | guest-mode-security | No private cloud access |
| Onboarding / Your Scholar | Partial | Account for cloud | Free; Class 9 gated | Pending | Pending | LearningProfile + local settings | Revision conflict/fallback | personalization-* | RC-001–003 |
| Dashboard | Pending | Account or guest | Mixed links | Pending | Pending | Local + server summaries | Shell/session boundary | startup, responsive | Account switching audit RC-006 |
| Scholar Today | Pending | Account or guest | Free | Pending | Pending | Local reminders | Empty state | reminders-engine/store | Sync scope needs explicit UI proof |
| Subjects / Study | Pending | Account or guest | Class 11 free; Class 9 gated | Pending | Pending | Local chapter progress | Missing-content fallback | v2-platform | Mobile subject/chapter switch |
| Chapter Command Centre | Partial | Account or guest | Mixed targets | Pending | Pending | Local guided flow | LAM fallback | lam-study-plan | Exact chapter destination flow |
| Ask LAM | Partial | Live account; guest demo | Authenticated Free | Pending | Pending | Local owner-scoped history | Provider/timeout/guest states | lam-panel-presence, ai-reliability | Real provider context journey |
| LAM AI / Live Tutor | Partial | Yes | Server entitlement | Pending | Pending | Provider session/local history | Provider fallback | live-tutor-*, user-ai-provider | Live microphone/provider unverified |
| LAM Living Identity | Partial | No | Shared settings | Pending | Pending | Owner-scoped preference | Reduced motion/visibility | lam-identity, lam-living-behavior | Preserve performance pass |
| Practice | Partial | Local or live account | Quotas/gates by action | Pending | Pending | Local + PracticeAttempt | Validation/quota | quiz-generation-contract | Real generation/save flow |
| Notes | Pending | Local guest; account-owned workspace | Free | Pending | Pending | Account-isolated local | Empty/save errors | account-workspace | Refresh and multi-tab proof |
| Resources | Partial | Public catalog; private intake auth | Mixed quota | Pending | Pending | StudyResource/chunks | Processing/retry/review | resource-api/engine/jobs/ssrf | Live private intake proof |
| E-Books (built-in) | Partial | Account or guest | Catalog/class gates | Pending | Pending | Local reading state | Page/OCR error | ebook-reading/page-text | Reader/OCR/LAM proof |
| Upload Your Own E-Book | Red | Yes | Monthly + storage limits | Pending | Pending | Original PDF + private job in PostgreSQL | Durable 503, invalid PDF rejection | ebook-upload/api/parser/ocr | RC-001–003; full live gate RC-005 |
| Exam Ready | Partial | Guest local; live auth | Free early beta | Pending | Pending | Local plan + cloud APIs | Retry/missing material | exam-ready-* | Full ordered mission proof |
| Mock Exam | Partial | Local or live auth | Quotas by generation | Pending | Pending | Plan/attempt evidence | Validation/quota | exam-ready-security/engine | Real completion/review proof |
| LAMTube | Partial | Browse guest; private library auth | Mixed | Pending | Pending | Local feed + owned videos | Playback error | lamtube-feed/security | Mobile playback interaction |
| LAMTube AI Video | Partial | Yes | Successful generation quota | Pending | Pending | Leased durable stages/audio | Safe retry/credit release | lamtube-pipeline/quota/edit-lease | Live provider/background completion |
| Study Music | Partial | Plus access | Plus | Pending | Pending | Local queue/favorites | Source playback error | study-music/routes/presentation | Visible compliant YouTube surface |
| Group Study | Partial | Host auth; join policy | Policy-controlled | Pending | Pending | PostgreSQL room/events | Conflict/reconnect/host repair | group-study-policy/sync/host-repair | Two-user live gate |
| Planner | Pending | Local workspace | Free | Pending | Pending | Local plans/reminders | Empty/validation | reminders-engine | Refresh/time-zone proof |
| AI Tools | Partial | Live generation auth | Tool-specific quotas | Pending | Pending | Local output + usage events | Provider/schema errors | ai-output-schema/reliability | Multiple real tool flows |
| Canvas | Pending | Workspace | Early beta | Pending | Pending | Local canvas | Empty/editor recovery | canvas-workspace | Mobile editor/keyboard proof |
| Experiments | Pending | Workspace | Mixed experimental gates | Pending | Pending | Feature-specific | Feature-specific | v2-platform | No silent disable to obtain pass |
| Scholar Plus | Partial | Purchase/account management auth | Paid; guest preview | Pending | Pending | Subscription/payment DB | Pending/rejected/expired | subscription-security, payment-workflow | Never grant from client/payment screenshot |
| Plugins & Connections | Partial | Yes for tokens | Connector-specific | Pending | Pending | Encrypted connector records | Reconnect/revoked consent | connector-crypto/browser | Token redaction/live consent proof |
| Google Drive | Partial | Yes + consent | Connector gate | Pending | Pending | Encrypted refresh token/imports | OAuth/revocation/provider errors | drive-connector/files | Live callback and import proof |
| Settings | Pending | Guest or account | Mixed | Pending | Pending | Local preferences + account APIs | Save/session retry | settings-usability | Small screen/modal interactions |
| Personalization | Partial | Guest preferences; account profile | Free/Class 9 gate | Pending | Pending | Revisioned LearningProfile | Stale revision/fallback | personalization-security/engine | Re-run and multi-tab proof |
| Feedback | Pending | Existing policy | Public/account | Pending | Pending | Feedback API | Submit error/validation | v2-platform | Live submission needs test scope |
| Privacy / Terms | Pending | No | Public | Pending | Pending | Static | Standard route boundary | public-auth | Canonical metadata RC-004 |
| Mobile navigation | Pending | Shell state | Gate-aware | Pending | Pending | Current route/local view | No-route/session states | responsive-overhaul | All specified viewport interactions |
| Android WebView | Pending | Same server auth | Same server gates | Pending | N/A | Native WebView + web storage | Native/network recovery | Source only | Physical-device gate RC-007 |

## Release gates

1. Zero unexplained critical test failures; isolated unit suite, lint, typecheck, production build.
2. Real authenticated uploaded-PDF journey, original byte preservation, OCR → actual LAM grounding, second-account denial, refresh and logout/login.
3. Free/Plus/developer fail-closed authority, account-switch/multi-tab privacy.
4. Two-client room roles/order/reconnect; real Google login/Drive and AI video provider paths.
5. Required phone/tablet/desktop/landscape interactions; real Android/iOS keyboard/viewport observations separately labeled.
6. Production metadata/env presence, canonical callback domain, migration prerequisites; no production writes or deployment in this task.

Evidence and changes: `sepb-issue-register.md`. Final decision will not be READY if a critical gate remains unverified.

## Final review overlay (baseline table retained above)

The table above is the pre-edit snapshot. Current detailed outcomes and all required report sections are in `sepb-release-candidate-report.md`; outstanding blocker/high gates are not converted to green by the following local results.

| Feature group | Current evidence | Current qualification |
|---|---|---|
| All existing unit-covered systems | 880 passed, zero failed / 92 isolated files; 12 additional real local provider probes pass | Contracts/adapters verified, not complete live journeys |
| Landing, login, help, privacy, terms, updates, sitemap | Actual local public HTTP 200; original landing visually rendered | Real account signup/login/consent/recovery still unverified |
| Guest navigation / Dashboard / Subjects / CCC | Real entry/drawer/modal navigation; all required width families for Dashboard/CCC; 320 Study | Local guest layouts/interactions, no full authenticated handoff proof |
| Ordinary Notes / guest preferences | Honest session-only note copy; new guest schema tested; actual Compact LAM setting survived reload | No new guest private-data retention; authenticated note editor durability unverified |
| E-Books / Uploaded PDFs | Actual built-in reader/annotation reload/keyboard; real parser/raster/OCR; three upload failures repaired | Built-in local proof and upload contracts; real uploaded DB/OCR/LAM/ownership flow remains blocker |
| Exam Ready / Mock Exam / Practice | Actual local budget change and ordered Calibrate→Repair; real scoreable Groq outputs; engine/security tests | Offline readiness not falsely counted; full signed-in completion/review outstanding |
| LAM / LAM Living Identity | Real provider streams/WAV, identity tests; new breakpoint/preference/no-overlap geometry | Hosted grounded chat/voice/physical-device performance unverified |
| Resources / AI Tools | Catalog settles to 126 sources; 320 layouts; intake/security and actual JSON/text probes | Private imports and every tool's authenticated UI/save/export incomplete |
| LAMTube / AI Video | Final feed layouts; leases/quota/recovery; real narration | Full hosted generate→background→playback→refresh unverified |
| Study Music / Plus / private features | Actual guest direct previews/gates + anonymous API denial; entitlement contracts pass | Real Plus playback/purchase/expiry/developer/browser coverage outstanding |
| Group Study | Mobile landing + host/action/order contracts | Actual two-user room/roles/reconnect/media remains blocker |
| Planner / Reminders / Scholar Today | Mobile entry + engine/store contracts | Rollover/notifications/multi-device incomplete; separate concurrent Your Scholar visibility changes preserved |
| Canvas / Experiments | Actual mobile/landscape Canvas rail/zoom/menu geometry; lab entry | Physical editor/keyboard/stylus and every experiment interaction not certified |
| Settings / Personalization / Feedback | Mobile settings/mode persistence; Feedback nested dialog; profile revision/security tests | Complete live profile/account/feedback delivery flows outstanding |
| Connections / Google login / Drive | Crypto/OAuth contracts; live configuration/UI inspected | Drive unconfigured; Google consent/callback unverified; email recovery unavailable |
| Mobile navigation / Android WebView | 92 settled captures across 24 routes/14 sizes; no document-wide overflow/framework overlay; precise header/LAM/Canvas checks | Emulation, not real virtual keyboard/file picker/permissions/WebView certification |

**Local checks passed; public-beta verdict remains NOT READY.** Changes are local only; no production write/deployment/push performed.

## October 8 staging overlay

`sepb-staging-execution.md` records approved isolated infrastructure work, actual resource identifiers, migration evidence and remaining account/provider gates. New staging PostgreSQL passed identity, empty-schema and write-permission checks; all 16 migrations applied, no existing users/files/rooms/videos. Core secrets are stage-specific. This satisfies infrastructure prerequisites only: authenticated persistence, Free/Plus comparison, OAuth/Drive/email, hosted AI, multi-client and physical-device rows above remain unverified. Current default regression count: 886 pass, zero fail, 14 opt-in skipped / 93 files. Production and main remain unchanged.
