# Task CANVAS-1 — Scholar Canvas

## File
- `src/components/views/canvas.tsx` (overwrite, 2722 lines)
- Exports `CanvasView` (named) and `CanvasView` (default)

## What was built
Professional infinite whiteboard workspace with:
- HTML5 Canvas drawing engine (DPR-aware, rAF render loop, dirty-flag redraw)
- Infinite pan (Hand tool, Space+drag, middle-mouse) and zoom (wheel-toward-cursor, Ctrl+wheel pinch, Shift+wheel horizontal, trackpad two-finger pan)
- 7 canvas types (Blackboard, Whiteboard, Plain Paper, Graph Paper, Ruled Notebook, Dot Grid, Dark Infinite) each with custom background/grid drawing in world-space
- Floating left toolbar (cv-glass-strong) with 4 grouped tool sections (Selection / Drawing / Shapes / Content) + Undo/Redo/Clear actions; tooltips with shortcut hints; active tool highlighted
- 5 distinct stroke engines: Pen (smooth bezier via midpoints), Marker (semi-transparent wide), Pencil (thin lower-opacity), Brush (variable width by stroke speed), Chalk (textured dot scatter for blackboard)
- 6 vector shapes (rectangle, circle, triangle, arrow, line, connector/S-curve) with Shift-to-constrain and optional fill
- Text tool + Sticky note tool with in-place HTML overlay editing (textarea positioned at world point, scaled by zoom)
- Eraser (hit-tests strokes/shapes by bbox + radius)
- Selection (click to select, Shift-click to add, drag to move all selected, Delete to remove, Ctrl+D to duplicate)
- Color picker panel (cv-glass): 16 preset swatches, native color input + HEX text field, recent-colors row (state-synced), opacity slider 1-100%, stroke width slider 1-50px with live preview
- Top floating bar (cv-glass): canvas type dropdown, editable board name, Saved/Unsaved indicator, zoom out / % / zoom in / fit controls, templates button, save button, export dropdown (PNG/JSON)
- Layers panel (cv-glass, right side, collapsible): per-layer visibility toggle, lock toggle, rename input, opacity slider, move up/down, delete; stats footer; active layer highlighting
- Templates panel (cv-glass-strong, on-demand): 8 templates — Cornell Notes, Mind Map, Flowchart, Kanban, Weekly Planner, Venn Diagram, SWOT Analysis, Lab Report — each pre-populates canvas with shapes/text/stickies and auto-fits view
- Undo/Redo history (50 snapshots, deep-clones objects+layers); Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z
- Keyboard shortcuts: V/H/L/P/M/E/B/K/X/R/C/G/A/D/O/T/N/F/I, Ctrl+S (save+XP+activity), Ctrl+D (duplicate), Delete, Space (pan), ? (toggle shortcuts dialog)
- Autosave to localStorage (`cv-board`) every 5s + on beforeunload; lazy-initialized state from localStorage on mount
- Export PNG (offscreen 2x-DPR canvas with bbox + padding) and Export JSON (full board data)
- Minimap (bottom-right, cv-glass): live canvas redrawn at 160×110, viewport rectangle highlighted, click-to-jump
- Coordinate display (bottom-right): live world X,Y + zoom %
- Jump-to-origin button + Shortcuts help dialog (bottom-left)
- First-run hint when canvas is empty

## Design system
- Liquid-glass chrome via injected `<style>` block (`cv-glass`, `cv-glass-strong` with ::before gradient borders, backdrop-filter blur)
- Solid `bg-black` root (no video, per spec)
- Fonts: Instrument Serif (italic headings) + Barlow (body) loaded via @import
- Full-bleed: root div uses `-m-4 lg:-m-6` to negate main padding, `min-h-[calc(100vh-4rem)]`
- All floating UI in cv-glass / cv-glass-strong with pill (9999px) rounded corners

## Performance
- Single rAF loop checks `dirtyRef` and redraws only when needed (60fps idle = ~0 CPU)
- Stroke points downsampled during drag (skip if move < 1.2/zoom world units)
- Viewport display state throttled to 60ms updates during pan/zoom to avoid React re-render churn
- Objects stored as vector data (not rasterized) so undo/redo and PNG export work cleanly
- Minimap is a separate child canvas that only redraws when its props change

## Lint & type-check
- `bun run lint` → 0 errors, 0 warnings (exit code 0)
- `bunx tsc --noEmit` → 0 errors in canvas.tsx

## Notes for future agents
- The `objects` and `layers` arrays live in BOTH refs (for render-loop/event-handler access) and React state (for UI/Minimap display). All mutations go through helpers that update the ref first, then call `syncCounters()` which copies the ref array into state. This is the React 19 / Next 16 idiomatic way to satisfy the `react-hooks/refs` lint rule.
- Lazy `useState(() => loadBoard()…)` initializers read localStorage during initial render so the mount effect doesn't need to setState synchronously (avoids `react-hooks/set-state-in-effect` error).
- The text/sticky editing overlay uses an HTML `<textarea>` positioned absolutely at the world point (converted to screen coords using `vpDisplay` state). Blur commits, Esc cancels.
