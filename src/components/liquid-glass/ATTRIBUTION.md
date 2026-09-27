# Scholar Liquid Glass — attribution

The refractive filter chain in this folder is adapted from the MIT-licensed
[`liquid-glass-react`](https://github.com/rdev/liquid-glass-react) reference
implementation used only as a technical and visual reference for this update.

```
Copyright 2025 MAX ROVENSKY

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the “Software”), to deal in the
Software without restriction, including without limitation the rights to use,
copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the
Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN
AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

## What was reused as design, not as code

Reused (design-level, re-implemented for Scholar):

- the idea of driving an SVG `feDisplacementMap` chain through the backdrop of a
  glass layer, using red for the x channel and blue for the y channel
- per-channel displacement scales + screen blends to produce chromatic aberration
  only near the edges
- deriving an edge mask from the displacement field itself so the centre of a
  surface stays perfectly sharp
- masked 1.5px border highlight, specular gradient and `mix-blend-mode` layering
- cursor attraction ("elasticity") and directional scale for a physical feel

Deliberately **not** reused:

- the pre-baked JPEG displacement maps (`src/utils.ts`). Scholar builds its own
  original gradient-based field in `glass-filter.tsx` — no binary asset, no
  canvas, no `toDataURL`, and a rectangular (not pill-only) falloff.
- the canvas `ShaderDisplacementGenerator` (`src/shader-utils.ts`). Scholar never
  runs shader mode: it is the least stable mode in the reference README and the
  most expensive at Scholar's surface count.
- the per-instance `<svg>` filter tree, per-instance `mousemove` + `resize`
  listeners and per-pointer-event React state. Scholar shares one filter set and
  one rAF pointer loop (see `glass-runtime.ts`).
- the module-level `navigator.userAgent` read in the component body, which is not
  safe under Next.js App Router server rendering.
