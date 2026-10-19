# Exam Ready 3.3 — localhost real Guest AI checkpoint

15 October 2026 (India time). Local `sepb-rc` work only. The immediate localhost request supersedes the previous staging-certification continuation. No commit, push, deployment, migration, account setup or production database change was made.

## Result

The actual localhost browser completed: Guest → Class 11 Physics → Laws of Motion → preparation → real, source-cited LAM explanation → natural contextual question → incorrect answer → real misconception feedback → different explanation → correct retry → a fresh independently verified bank question. Provider failures and exhausted allowance also leave explicitly labelled stored guidance available. Offline guidance is not evidence of live success.

The setup is a seven-step Liquid Glass wizard: goal, exam details, subjects/chapters, confidence, time, materials and preview. It preserves the academic library, existing LAM identities/animations and study workspace. Preferences live in a separate adjustment dialog. Card selections, step changes, controls and workspace transitions animate, with reduced-motion support. A truthful six-second build transition uses the local planning engine; it does not pretend an AI call is running.

## Exact local configuration

Run from `C:\Users\Lenovo\Desktop\SCHOLAR\Scholar-V1`:

```powershell
bun run dev:exam-ready
```

Open `http://127.0.0.1:3002/exam-prep` in Guest mode. The ignored `.env.development.local` contains `SCHOLAR_DEV_GUEST_AI=1`. The dedicated launcher sets `SCHOLAR_DEV_GUEST_AI_LOCAL_SERVER=1` for its child process and binds **127.0.0.1**, not a LAN interface. Both flags plus `NODE_ENV=development` are necessary. Ordinary `bun run dev`, a copied flag alone, production, Vercel preview/staging and CI fail closed.

The ignored `.exam-ready-dev/approved-budget.json` pins the approved provider/model and durable spending counters. A missing or malformed ledger permits **zero** live requests. The final pin is `nvidia` / `nvidia/nemotron-3-ultra-550b-a55b`. The existing server-side `NVIDIA_TEXT_API_KEY` or `NVIDIA_API_KEY` is used by Scholar’s adapter; no credential is copied to the client. Gemini/Groq credentials and production authentication are not altered.

Current allowance: **12 used / 12 approved attempts; zero remaining**. Failed attempts stay consumed. Maximum input is 24,000 bytes, output is 4,000 tokens, request body 32,000 bytes and total reserved-token ceiling 336,000. Actual core turns requested at most 2,400 output tokens; grading requested 2,000. There are no hidden retries or automatic provider/model changes. The local deadline is 120 seconds (client 130 seconds).

The ledger originally tracked 210,410 conservatively reserved prompt/output units. A final accounting audit also reserved 20,022 for schema overhead: six Gemini attempts × the largest current full schema, 3,337 bytes. The final reservation is **230,432 / 336,000**, with all historical events/call counts preserved. Prospective Gemini reservations include their actual response-schema bytes. This is a conservative reservation, **not a report of actual billed tokens or price**. Even the largest earlier prompt plus that full-schema allowance remains below 24,000 bytes.

Do not reset, refund or enlarge the ledger to continue testing. Another bounded user approval is required for new live requests; saved lessons, notes, library browsing and deterministic checks remain available meanwhile.

## Actual live request results

| Attempts | Provider/model | Actual result |
| --- | --- | --- |
| 1–3 | Gemini 2.5 Flash | Generation returned HTTP 404. A catalog listing was not proof of generation access. The first two were shared-budget local Chemistry attempts; the third was the Physics check. All counted. |
| 4 | Gemini 3.8 Flash | HTTP 503 overload; no usable lesson. |
| 5 | Gemini 3.8 Flash | Deadline timeout at the then-current 50-second limit; no usable lesson. |
| 6 | Gemini 3.8 Flash | HTTP 503 overload; no usable lesson. |
| 7–8 | NVIDIA Nemotron 3 Ultra | Real responses received; a formula array used objects where the wire contract required strings, so validation initially rejected the core. |
| 9 | NVIDIA Nemotron 3 Ultra | Real contextual, simpler explanation of gravity/normal balance and zero resultant; citations accepted. |
| 10 | NVIDIA Nemotron 3 Ultra | Real feedback on the wrong constant-velocity answer; score 0, independently checked against the bank key. |
| 11 | NVIDIA Nemotron 3 Ultra | Real misconception repair using balanced forces/drive versus drag, plus a supported-book example and a fresh bank check. |
| 12 | NVIDIA Nemotron 3 Ultra | Real feedback on the correct retry; score 1, independently checked. An incomplete rough-surface next-step assumption was caught and transparently clarified. |

Provider changes were separately approved by the user; there was no automatic failover. No live 429 occurred in this batch. No-cost adapter tests verify preservation of 429/Retry-After and single-fetch transport; the Guest ledger halts on a provider 429.

Attempt 8’s genuine response was restored **without another paid call** after lossless shape repair and all source/academic validators. Because it predated automatic rejected-output retention, its bounded diagnostic output was reattached to the matching synthetic owner/session/stage during debugging. It was not rewritten as a mock or substituted with authored text. The UI labels this as a saved real response restored after format repair. New failures automatically retain bounded rejected core output for explicit validated recovery.

## Journey and correctness evidence

Synthetic preparation: `Local Guest — Laws of Motion`, Class 11 / CBSE / Physics / p5, two-hour budget, weak starting confidence, Scholar materials, diagnostic off. No private upload or production account data was used.

The student asked: “If gravity is still acting on the moving puck, why do we say its net force is zero? Explain this more simply using the lesson we just studied.” LAM correctly explained downward gravity and upward normal balance on a level frictionless track, no horizontal imbalance, and zero acceleration rather than zero velocity.

Wrong answer: **“A forward force is required.”** Real feedback identified confusion between force and velocity and explained why constant vector velocity in an inertial frame requires zero resultant. The independent MCQ verifier gave 0/1.

Correct retry: **“Their vector resultant is zero, though individual forces may be present.”** Real feedback and the independent verifier agreed on 1/1. The next visible bank question asked why a book can remain stationary on a table; the correct option is that weight and normal balance on the book. These forces are not a third-law pair because both act on one body.

The supported-book example was independently verified: 2 kg, g = 10 m/s² → weight 20 N downward and normal 20 N upward under the stated stationary horizontal-table conditions. Examples/checks may be supplied by Scholar’s verified bank, and the UI says so; the new question is not claimed as freshly AI-generated. Two checked answers produce 50% checked accuracy and **Calibrating**, not invented mastery.

### Quality limitation caught

Attempt 12 suggested a constant-velocity block on a rough surface but mentioned gravity, normal and friction without explicitly adding a horizontal applied force to balance friction. The lesson UI now appends a narrow, clearly labelled **“Source-based clarification (not a new AI response)”** explaining this missing assumption. This is evidence that live feedback is not infallible, not a claim of perfect AI accuracy. The original raw feedback is retained.

More-detail, harder-question, example, quiz, revision and related controls are wired through the same bounded teaching path and deterministic tests. The limited live batch did **not** separately exercise every control, every question kind or every chapter. Whole-curriculum completeness and expert certification remain open. Existing independent-library coverage limitations remain visible.

## Guest security controls

- Opt-in and dedicated loopback startup; deployment/CI markers and non-loopback authorities reject access.
- Exact same-origin mutations, Host/port and forwarding checks, plus Sec-Fetch-Site checks; no cross-origin anonymous AI proxy.
- Random 256-bit capability in an HTTPOnly, SameSite=Strict cookie scoped to the dedicated API; hashed owner files, isolated session IDs and revision fencing.
- Only independent built-in Exam Ready sources; account uploads, private-only modes, ebook/cross-section IDs and other owners’ preparations are refused.
- Public session serialization redacts answers, numerical keys, rubrics and hidden hints; deterministic answer verification stays server-side.
- Durable global budget reservation before transport, one live turn at a time, three-second spacing, 30 mutations/minute per owner, ten preparations per owner, bounded input/output/state.
- Exclusive disk locks and atomic saves; a crash leaves a lock closed rather than replenishing spending. Do not remove a stale lock until the stopped process has been independently verified.
- Missing credentials, invalid budget, quota exhaustion or a halted allowance cannot start a provider request. No browser API keys, PostgreSQL requirement, production entitlement relaxation or alternate-key retry.

The local mode skips only the optional PostgreSQL feature-flag lookup, using the existing environment/default fallback. The workspace’s incompatible SQLite URL was not replaced with production credentials. This was validated locally; no authenticated production/staging security certification is claimed.

## Validation and small fixes

TypeScript and targeted ESLint pass. The final isolated regression result is **1,193 pass / 0 fail / 16 opt-in skips across 108 files**, recorded in `test-artifacts/exam-ready-local-guest-regression.json` (no live tests enabled). Separate mocked SDK contract tests verify structured Gemini JSON, low thinking, preserved HTTP status and no automatic retry; they are not counted as live success. Sanitized live results and the unreplenished ledger events are recorded in `test-artifacts/exam-ready-local-guest-live-evidence.json`.

Actual browser checks included the real teaching journey, allowance exhaustion with unchanged 12-call ledger, persisted paused preparation, independent readable library, all seven setup steps, saved adjustments, private-card locks, preview and six-second build. Desktop 1440×900 and mobile 390×844 screenshots were inspected. Mobile wizard width/scroll width is 366/366; the avatar is 85 px, fully inside its card. Search keeps Laws of Motion’s original chapter number 5 instead of renumbering a filtered result.

Additional fixes: composer clears only after successful replies and preserves changed/failed drafts; failed-turn counters refresh via a read-only status request, never a provider retry; formula symbols render as math; original-source citations use stored-source labels; no incomplete output is passed off as mastery; last accepted stages are retained; exhausted allowance text distinguishes approval/budget from provider outage. Settings update logs include both the material changes and these small fixes.

Screenshots: `exam-ready-local-setup-desktop.jpg`, `exam-ready-local-setup-mobile.jpg`, `exam-ready-local-adjust-mobile.jpg`, `exam-ready-local-preview-mobile.jpg`, `exam-ready-local-building.jpg`, and prior live retry evidence `exam-ready-local-live-retry.jpg`. The prior retry screenshot predates the added friction clarification; the raw response and correction are both documented above.

The dedicated local server is left running. The live allowance is exhausted. Staging work remains paused until explicitly requested.
