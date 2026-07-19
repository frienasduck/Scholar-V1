# Agent Context: TOOLBOX-1

## Task
Build Scholar Toolbox — ultimate student utility hub (12 tools + searchable homepage)

## File
- Path: `/home/z/my-project/src/components/views/toolbox.tsx`
- Export: `ToolboxView` (named) + `export default ToolboxView`

## Status: COMPLETE

### Lint Result
- `bun run lint` → **0 errors, 0 warnings**

### File Stats
- 3311 lines
- Self-contained (only imports from React, framer-motion, sonner, lucide-react, shadcn/ui, @/lib/store, @/lib/utils)
- No `eval()`, no `any`, no setState-in-effect, no ref-during-render

### Tools Implemented (12, matching spec exactly)
1. **Standard Calculator** — display, button grid, memory (MC/MR/M+/M−), history (click to reuse), copy result, keyboard support
2. **Scientific Calculator** — trig (sin/cos/tan/asin/acos/atan, deg/rad toggle), log (log/ln/log2/exp), powers (x²/x³/xʸ/√/∛/10ˣ), factorial, constants (π/e), 1/x, |x|, scientific notation (EE)
3. **Unit Converter** — 10 categories (Length, Mass, Temperature, Area, Volume, Speed, Time, Data Storage, Energy, Pressure), swap button, copy result
4. **Periodic Table** — all 118 elements, color-coded by category (11 categories), click → detail panel (atomic number, symbol, name, mass, electron config, category, melt/boil point, density, discovery year, uses), search by name/symbol/number, category filter
5. **Stopwatch** — millisecond precision (MM:SS.ms), Start/Pause/Reset, lap times with Fast/Slow badges, fullscreen toggle, export laps to .txt
6. **Countdown Timer** — multi-timer (up to 6), H/M/S input, Start/Pause/Reset, 6 presets (5/10/15/25/45/60 min), visual SVG progress ring, sound alert (Web Audio API beep x2), toast on completion
7. **World Clock** — local time + 6 cities (Tokyo, London, New York, Sydney, Dubai, Los Angeles), updates every second, 12/24h toggle, day/night indicator with Sun/Moon icon
8. **Graph Plotter** — 3 functions with different colors, canvas with grid/axes/labels, zoom (button + scroll wheel), pan (drag), cursor coordinates, 10 example functions
9. **Random Generators** — Number (min/max/count/unique), Dice (visual 6-sided with pips), Coin (visual heads/tails flip), Color (HEX+RGB display), Password (length slider, 4 char-type toggles, strength meter, show/hide), Student Picker (paste names, animated selection)
10. **Physics Calculator** — Projectile (range/max height/time of flight), Ohm's Law (V/I/R + Power, solve any 2 of 3), Mechanics (Force, KE, PE)
11. **Chemistry Calculator** — Molar Mass (formula parser, breakdown), pH calculator (H⁺/OH⁻ input, nature badge, pH scale visualization), Dilution (C1V1=C2V2, solve any 3 of 4), Gas Law (PV=nRT, K/°C toggle, solve any 3 of 4)
12. **Math Utilities** — Prime check + factorization, LCM/HCF, Factorial, Statistics (count/sum/mean/median/mode/range/min/max/variance/stdDev), Quadratic solver (real + complex roots)

### Homepage Features
- Search bar (filters tools by name, description, keywords)
- Category chips: All | Math | Science | Convert | Time | Productivity | Random
- Tool cards grid (icon, name, description, category color, accent border, hover lift, gradient glow)
- Favorites (pin tools, localStorage `tb-favorites`, star icon toggle)
- Recent tools (last 5, localStorage `tb-recent`)
- Click card → opens tool in shadcn Dialog with size based on tool's `dialogSize` (sm/md/lg/xl)
- XP + coins + activity push on first use of each tool (via Zustand store)

### Safe Expression Parser
- Tokenizer: handles numbers, scientific notation, functions, constants (π/e/τ), variables (x), operators (+ − × ÷ ^ % !), parentheses, comma, unary minus, implicit multiplication (e.g. `2x` → `2*x`, `2pi` → `2*pi`)
- Shunting-Yard algorithm → RPN
- RPN evaluator: trig (deg/rad aware), log functions, powers, factorial, abs/floor/ceil/round/sign
- `compileExpr()` returns a closure for fast repeated evaluation (used by Graph Plotter)
- `evaluate()` for one-shot evaluation (used by calculators)
- NO `eval()` anywhere

### Lint-Fix Patterns Used
1. **setState-in-effect (UnitConverter)**: Split into outer component holding `catId` + inner `<UnitConverterInner key={catId} />`. The inner uses `useState(cat.units[0].id)` to initialize from/to on mount; the `key` prop forces remount when category changes — no useEffect needed.
2. **setState-in-effect (Timer)**: Initialize `remaining` via `useState(totalSet)` from props (only on mount). The countdown interval only depends on `[running]`, reads `endRef.current` set in `toggle()` handler. Parent passes a stable timer.id so each TimerCard instance is fresh.
3. **ref-during-render (GraphPlotter)**: Replaced `dragRef.current ?` check during render with `isDragging` state (set true/false in mouse down/up handlers).
4. **setState-in-effect (PasswordGenerator)**: Extracted `generatePassword()` to module-level function (takes all params as args). Used `useState(() => generatePassword(16, true, true, true, true))` lazy initializer — no useEffect needed for initial generation.

### Design System
- Dark mode first, glassmorphism with `.tb-glass` and `.tb-glass-strong` CSS classes (injected via `<style>` tag with prefix `tb-`)
- Fonts: Instrument Serif (italic display) + Inter (body), loaded via Google Fonts @import in `<style>`
- All text white/white-70
- Framer Motion staggered entrances (hero, search, chips, tool cards)
- AnimatePresence for periodic table detail panel + filtered tool grid
- Ambient background orbs (indigo, violet, teal, pink blurred circles)
- Full-bleed: `-m-4 lg:-m-6` on root, content in `max-w-7xl mx-auto`
- Responsive: grid-cols-2 (mobile) → grid-cols-3 (sm) → grid-cols-4 (lg)
- Custom scrollbar styling (`.tb-scroll`)
- Radix select/dialog styling overrides for dark theme

### Helpers
- `useLocalStorage<T>(key, initial)` — persisted state hook
- `copyToClipboard(text)` — with sonner toast
- `downloadTextFile(filename, content)` — creates Blob + anchor click
- `playBeep(freq, duration, volume)` — Web Audio API sine wave
- `secureRandomInt(max)` — crypto.getRandomValues with fallback
- `gcd(a, b)`, `isPrime(n)`, `factorialBig(n)`, `parseNumList(s)` — math helpers
- `formatNum(n, maxDigits)` — smart number formatter (handles integers, scientific notation, precision)

### Verification
- `bun run lint`: 0 errors, 0 warnings ✓
- File: 3311 lines ✓
- All 12 spec'd tools present ✓
- All 118 periodic elements present ✓
- No `eval()`, no `any` ✓
- Self-contained (no new files created) ✓
