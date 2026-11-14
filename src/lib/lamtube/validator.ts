import type { ScenePlan } from "./model";

type Element = ScenePlan["elements"][number];

const TEXTUAL_KINDS = new Set(["label", "equation", "latex", "rect", "table"]);
const CARD_KINDS = new Set(["equation", "latex", "rect", "table"]);

function estBounds(el: Element) {
  const x = el.x;
  const y = el.y;
  const isMath = el.kind === "latex" || el.kind === "equation";
  const isAtom = el.kind === "atom";
  const hasFrac = isMath && (el.latex || el.text || "").includes("frac");
  const w = Math.max(isMath ? 290 : isAtom ? 210 : 60, Math.abs(el.w || (isMath ? 320 : isAtom ? 220 : 180)));
  const h = Math.max(hasFrac ? 120 : isMath ? 78 : isAtom ? 210 : 42, Math.abs(el.h || (isMath ? 82 : isAtom ? 220 : 56)));
  return { x1: x, y1: y, x2: x + w, y2: y + h, w, h };
}

function overlapArea(a: ReturnType<typeof estBounds>, b: ReturnType<typeof estBounds>, pad = 16) {
  const ox = Math.max(0, Math.min(a.x2 + pad, b.x2 + pad) - Math.max(a.x1, b.x1));
  const oy = Math.max(0, Math.min(a.y2 + pad, b.y2 + pad) - Math.max(a.y1, b.y1));
  return ox * oy;
}

/**
 * Deterministic scene hygiene and math/layout stabilizer:
 * - Keeps elements inside visible safe canvas margins
 * - Separates colliding text/equation labels so frames stay readable
 * - Ensures Bohr atomic shell arrays & coordinate plot curves are valid
 */
export function stabilizeScenePlan(plan: ScenePlan): ScenePlan {
  const elements: Element[] = plan.elements.map((el) => {
    const next = { ...el };
    if (next.kind === "arrow") {
      next.x = Math.min(920, Math.max(60, next.x));
      next.y = Math.min(820, Math.max(100, next.y));
      return next;
    }

    next.x = Math.min(880, Math.max(45, next.x));
    next.y = Math.min(780, Math.max(95, next.y));
    next.w = Math.min(910 - next.x, Math.max(20, next.w));
    next.h = Math.min(835 - next.y, Math.max(20, next.h));

    if (next.kind === "plot") {
      const curve = Array.isArray(next.curve) ? next.curve.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y)) : [];
      if (curve.length >= 2) {
        const xs = curve.map((p) => p.x);
        const ys = curve.map((p) => p.y);
        const dataMinX = Math.min(...xs);
        const dataMaxX = Math.max(...xs);
        const dataMinY = Math.min(...ys);
        const dataMaxY = Math.max(...ys);
        const minX = next.xRange ? Math.min(next.xRange[0], dataMinX) : dataMinX;
        const maxX = next.xRange ? Math.max(next.xRange[1], dataMaxX) : dataMaxX;
        const rawMinY = next.yRange ? Math.min(next.yRange[0], dataMinY) : dataMinY;
        const rawMaxY = next.yRange ? Math.max(next.yRange[1], dataMaxY) : dataMaxY;
        const spanY = Math.max(1e-3, rawMaxY - rawMinY);
        const minY = dataMinY < (next.yRange?.[0] ?? Infinity) ? rawMinY - spanY * 0.06 : rawMinY;
        const maxY = dataMaxY > (next.yRange?.[1] ?? -Infinity) ? rawMaxY + spanY * 0.08 : rawMaxY;
        next.xRange = [minX, maxX === minX ? minX + 1 : maxX];
        next.yRange = [minY, maxY === minY ? minY + 1 : maxY];
        next.curve = curve;
      }
    }

    if (next.kind === "atom") {
      next.w = Math.max(next.w, 210);
      next.h = Math.max(next.h, 210);
      if (next.charge === "0" || /^neutral$/i.test(next.charge ?? "")) {
        delete next.charge;
      }
      const protons = Math.max(1, Math.min(36, Math.round(next.protons ?? 11)));
      next.protons = protons;
      if (!next.shells?.length) {
        const caps = [2, 8, 8, 18];
        const shells: number[] = [];
        let rem = protons;
        for (const cap of caps) {
          if (rem <= 0) break;
          const take = Math.min(cap, rem);
          shells.push(take);
          rem -= take;
        }
        next.shells = shells;
      }
      next.symbol = (next.symbol || next.text || "X").slice(0, 6);
    }

    return next;
  });

  // Separate textual cards/labels from each other AND keep cards/labels off atom & plot boxes cleanly.
  const diagramObstacles = elements.filter((e) => e.kind === "atom" || e.kind === "plot");
  const placed: Element[] = [];
  for (const el of elements) {
    if (TEXTUAL_KINDS.has(el.kind)) {
      const blockers = [
        ...placed.filter((o) => TEXTUAL_KINDS.has(o.kind)),
        ...diagramObstacles.filter((d) => {
          if (d === el) return false;
          if (d.kind === "atom") return true;
          // Keep full formula/rect/table cards clear of plots, while allowing tiny curve point tags inside plots
          return CARD_KINDS.has(el.kind) || (el.text?.length ?? 0) > 18;
        }),
      ];
      let guard = 0;
      while (guard < 8) {
        const b = estBounds(el);
        const hit = blockers.find((other) => overlapArea(b, estBounds(other), 14) > 0);
        if (!hit) break;
        const hb = estBounds(hit);
        const targetY = Math.round(hb.y2 + 20);
        if (targetY <= 810 && targetY !== el.y) {
          el.y = targetY;
        } else {
          const shiftedX = el.x + 280 <= 820 ? el.x + 280 : Math.max(45, el.x - 280);
          if (shiftedX === el.x) break;
          el.x = shiftedX;
          el.y = Math.max(115, Math.min(720, el.y - 120));
        }
        guard++;
      }
    }
    placed.push(el);
  }

  return { ...plan, elements: placed };
}
