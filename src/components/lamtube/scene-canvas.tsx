"use client";
import { memo, useId } from "react";
import { palette } from "@/lib/lamtube/model";
import type { Scene, ScenePlan } from "@/lib/lamtube/model";
import { frame } from "@/lib/lamtube/timeline";
function lines(text: string, limit = 38) {
  const rows: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    if (line && line.length + word.length > limit) {
      rows.push(line);
      line = "";
    }
    line += (line ? " " : "") + word;
  }
  if (line) rows.push(line);
  return rows.slice(0, 4);
}
function Primitive({
  e,
  marker,
}: {
  e: ScenePlan["elements"][number];
  marker: string;
}) {
  const color = palette[e.color];
  const text = (
    <text
      fill={color}
      fontSize={e.kind === "equation" ? 42 : 29}
      fontFamily={
        e.kind === "equation" ? "Georgia,serif" : "Inter,system-ui,sans-serif"
      }
    >
      {lines(e.text, e.kind === "equation" ? 34 : 38).map((line, i) => (
        <tspan key={i} x={0} dy={i ? 42 : 0}>
          {line}
        </tspan>
      ))}
    </text>
  );
  if (e.kind === "label" || e.kind === "equation") return text;
  if (e.kind === "rect" || e.kind === "highlight")
    return (
      <>
        <rect
          width={e.w}
          height={e.h}
          rx={e.kind === "rect" ? 22 : 10}
          fill={color}
          fillOpacity={e.kind === "rect" ? 0.16 : 0.08}
          stroke={color}
          strokeWidth={2}
        />
        <g transform={`translate(18 ${Math.max(34, e.h / 2)})`}>{text}</g>
      </>
    );
  if (e.kind === "circle")
    return (
      <>
        <ellipse
          cx={e.w / 2}
          cy={e.h / 2}
          rx={e.w / 2}
          ry={e.h / 2}
          fill={color}
          fillOpacity={0.13}
          stroke={color}
          strokeWidth={3}
        />
        <g transform={`translate(18 ${e.h / 2})`}>{text}</g>
      </>
    );
  if (e.kind === "arrow")
    return (
      <>
        <path
          data-draw="true"
          d={`M 0 0 L ${e.w} ${e.h}`}
          pathLength={1}
          fill="none"
          stroke={color}
          strokeWidth={5}
          markerEnd={`url(#${marker})`}
        />
        <g transform="translate(0 -26)">{text}</g>
      </>
    );
  if (e.kind === "table")
    return (
      <>
        {e.rows.map((row, i) => (
          <g key={i} transform={`translate(0 ${i * 60})`}>
            <rect
              width={Math.max(e.w, 320)}
              height={54}
              rx={10}
              fill={color}
              fillOpacity={0.06}
              stroke={color}
              strokeOpacity={0.3}
            />
            <text x={16} y={34} fill={color} fontSize={24}>
              {row}
            </text>
          </g>
        ))}
      </>
    );
  const path = e.points
    .map(
      (p, i) => `${i ? "L" : "M"} ${(p.x * e.w) / 1000} ${(p.y * e.h) / 1000}`
    )
    .join(" ");
  return (
    <>
      <path
        data-draw="true"
        d={path}
        pathLength={1}
        fill="none"
        stroke={color}
        strokeWidth={e.kind === "graph" ? 5 : 3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {e.text && <g transform="translate(0 -22)">{text}</g>}
    </>
  );
}
export function paintScene(
  svg: SVGSVGElement | null,
  scene: Scene,
  time: number,
  reduced: boolean
) {
  if (!svg) return;
  const state = frame(scene, time, reduced);
  const camera = svg.querySelector<SVGGElement>("[data-camera]");
  camera?.setAttribute(
    "transform",
    `translate(${state.camera.x} ${state.camera.y}) translate(500 500) scale(${state.camera.zoom}) translate(-500 -500)`
  );
  if (camera)
    camera.style.opacity = String(
      reduced
        ? 1
        : Math.min(
            1,
            Math.max(0, time / 0.25),
            Math.max(0, (scene.duration - time) / 0.25)
          )
    );
  scene.elements.forEach((e) => {
    const node = svg.querySelector<SVGGElement>(`[data-element="${e.id}"]`);
    const value = state.elements.get(e.id)!;
    if (!node) return;
    node.style.opacity = String(value.opacity);
    node.setAttribute(
      "transform",
      `translate(${e.x + value.dx} ${e.y + value.dy}) scale(${value.scale})`
    );
    node.querySelectorAll<SVGPathElement>("[data-draw]").forEach((p) => {
      p.style.strokeDasharray = "1";
      p.style.strokeDashoffset = String(1 - value.draw);
    });
  });
}
export const SceneCanvas = memo(function SceneCanvas({
  scene,
  svgRef,
}: {
  scene: Scene;
  svgRef: React.RefObject<SVGSVGElement | null>;
}) {
  const marker = useId().replace(/:/g, "");
  return (
    <svg
      ref={svgRef}
      viewBox="0 0 1000 1000"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={`${scene.title}: ${scene.goal}`}
      className="lt-canvas"
    >
      <title>{scene.title}</title>
      <desc>{scene.goal}</desc>
      <defs>
        <marker
          id={marker}
          viewBox="0 0 12 12"
          refX="10"
          refY="6"
          markerWidth="5"
          markerHeight="5"
          orient="auto"
        >
          <path d="M 0 0 L 12 6 L 0 12 Z" fill="context-stroke" />
        </marker>
      </defs>
      <g data-camera>
        {scene.elements.map((e) => (
          <g
            key={e.id}
            data-element={e.id}
            transform={`translate(${e.x} ${e.y})`}
          >
            <Primitive e={e} marker={marker} />
          </g>
        ))}
      </g>
    </svg>
  );
});
