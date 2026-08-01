"use client";

import { memo, type PointerEvent as ReactPointerEvent } from "react";
import { ScholarAIContent } from "@/components/ai/scholar-ai-content";
import type { CanvasObject } from "@/lib/canvas-workspace";

type Props = {
  object: CanvasObject;
  selected: boolean;
  onPointerDown: (event: ReactPointerEvent<SVGGElement>, object: CanvasObject) => void;
  onDoubleClick: (object: CanvasObject) => void;
};

const HAND_FONT = '"Segoe Print","Comic Sans MS",cursive';
const UI_FONT = 'Inter,ui-sans-serif,system-ui,sans-serif';

function drawingPath(object: CanvasObject) {
  const points = object.points ?? [];
  if (!points.length) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y} l .1 .1`;
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let index = 1; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    path += ` Q ${current.x} ${current.y} ${(current.x + next.x) / 2} ${(current.y + next.y) / 2}`;
  }
  const last = points[points.length - 1];
  return `${path} L ${last.x} ${last.y}`;
}

function linePath(object: CanvasObject) {
  const width = Math.max(8, object.width);
  const height = object.height;
  if (object.lineStyle === "curved") {
    return `M 0 ${height} C ${width * 0.3} ${height * -0.35}, ${width * 0.68} ${height * 0.05}, ${width} 0`;
  }
  if (object.lineStyle === "elbow") {
    return `M 0 ${height} H ${width * 0.55} V 0 H ${width}`;
  }
  return `M 0 ${height} L ${width} 0`;
}

function Shape({ object }: { object: CanvasObject }) {
  const common = {
    fill: object.fill ?? "transparent",
    stroke: object.color,
    strokeWidth: object.strokeWidth ?? 2,
  };
  switch (object.shape) {
    case "ellipse":
      return <ellipse {...common} cx={object.width / 2} cy={object.height / 2} rx={object.width / 2} ry={object.height / 2} />;
    case "triangle":
      return <polygon {...common} points={`${object.width / 2},0 ${object.width},${object.height} 0,${object.height}`} />;
    case "diamond":
      return <polygon {...common} points={`${object.width / 2},0 ${object.width},${object.height / 2} ${object.width / 2},${object.height} 0,${object.height / 2}`} />;
    case "hexagon":
      return <polygon {...common} points={`${object.width * 0.25},0 ${object.width * 0.75},0 ${object.width},${object.height / 2} ${object.width * 0.75},${object.height} ${object.width * 0.25},${object.height} 0,${object.height / 2}`} />;
    case "rectangle":
      return <rect {...common} width={object.width} height={object.height} />;
    default:
      return <rect {...common} width={object.width} height={object.height} rx={Math.min(22, object.height / 4)} />;
  }
}

function TextContent({ object }: { object: CanvasObject }) {
  const fontFamily = object.handwritten ? HAND_FONT : UI_FONT;
  if (object.type === "formula") {
    return (
      <div className="cv-object-formula" style={{ color: object.color }}>
        <ScholarAIContent
          content={`\\[${object.text || String.raw`E=mc^2`}\\]`}
          mode="compact"
          normalizeLegacy={false}
        />
      </div>
    );
  }
  if (object.type === "table") {
    const rows = (object.text ?? "").split("\n").map((row) => row.split("|").map((cell) => cell.trim()));
    return (
      <table className="cv-object-table">
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={`${object.id}-${rowIndex}`}>
              {row.map((cell, cellIndex) => rowIndex === 0
                ? <th key={cellIndex}>{cell}</th>
                : <td key={cellIndex}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  if (object.type === "checklist") {
    return (
      <div className="cv-checklist" style={{ fontFamily }}>
        {(object.text ?? "").split("\n").filter(Boolean).map((line, index) => (
          <div key={index}><span>✓</span><p>{line}</p></div>
        ))}
      </div>
    );
  }
  if (object.type === "flashcard") {
    const [front, ...back] = (object.text ?? "").split("\n");
    return (
      <div className="cv-flashcard">
        <span>FLASHCARD</span>
        <strong>{front?.replace(/^Front:\s*/i, "") || "Concept"}</strong>
        <p>{back.join("\n").replace(/^Back:\s*/i, "") || "Explanation"}</p>
      </div>
    );
  }
  if (object.type === "question") {
    const [title, ...body] = (object.text ?? "").split("\n");
    return (
      <div className="cv-question">
        <span>QUESTION</span>
        <strong>{title || "Question"}</strong>
        <p>{body.join("\n")}</p>
      </div>
    );
  }
  if (object.type === "source") {
    return (
      <div className="cv-source-card">
        <span>SCHOLAR SOURCE</span>
        <strong>{object.sourceLabel || object.name}</strong>
        <p>{object.text}</p>
        <small>{object.sourceView ? `Open in ${object.sourceView}` : "Linked study material"}</small>
      </div>
    );
  }
  if (object.type === "sticky") {
    return (
      <div className="cv-sticky-content" style={{ fontFamily }}>
        <span className="cv-sticky-pin" />
        <p>{object.text || "Note"}</p>
      </div>
    );
  }
  return (
    <div
      className="cv-text-content"
      style={{
        color: object.color,
        fontFamily,
        fontSize: object.name === "Title" ? 34 : object.handwritten ? 22 : 18,
        fontWeight: object.name === "Title" ? 600 : 450,
      }}
    >
      {object.text}
    </div>
  );
}

export const CanvasObjectRenderer = memo(function CanvasObjectRenderer({
  object,
  selected,
  onPointerDown,
  onDoubleClick,
}: Props) {
  if (!object.visible) return null;
  const transform = `translate(${object.x} ${object.y}) rotate(${object.rotation} ${object.width / 2} ${object.height / 2})`;
  const hasHtml = ["text", "sticky", "formula", "table", "source", "checklist", "flashcard", "question"].includes(object.type);

  return (
    <g
      transform={transform}
      opacity={object.opacity}
      className={selected ? "cv-object cv-object-selected" : "cv-object"}
      data-object-id={object.id}
      onPointerDown={(event) => onPointerDown(event, object)}
      onDoubleClick={() => onDoubleClick(object)}
      role="group"
      aria-label={`${object.name}${object.locked ? ", locked" : ""}`}
    >
      {object.type === "drawing" && (
        <path
          d={drawingPath(object)}
          fill="none"
          stroke={object.color}
          strokeWidth={object.strokeWidth ?? 3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      {object.type === "shape" && <Shape object={object} />}
      {object.type === "line" && (
        <path
          d={linePath(object)}
          fill="none"
          stroke={object.color}
          strokeWidth={object.strokeWidth ?? 2}
          strokeDasharray={object.lineStyle === "dashed" ? "10 7" : undefined}
          markerStart={object.arrowStart ? "url(#cv-arrow-start)" : undefined}
          markerEnd={object.arrowEnd ? "url(#cv-arrow-end)" : undefined}
        />
      )}
      {object.type === "image" && object.imageUrl && (
        <>
          <rect width={object.width} height={object.height} rx={16} fill="rgba(255,255,255,.04)" />
          <image
            href={object.imageUrl}
            width={object.width}
            height={object.height}
            preserveAspectRatio="xMidYMid meet"
            clipPath="inset(0 round 16px)"
          />
        </>
      )}
      {object.type === "frame" && (
        <>
          <rect
            width={object.width}
            height={object.height}
            rx={16}
            fill={object.fill ?? "transparent"}
            stroke={object.color}
            strokeWidth={object.strokeWidth ?? 2}
            strokeDasharray="7 6"
          />
          <foreignObject x={14} y={8} width={Math.max(80, object.width - 28)} height={42}>
            <div className="cv-frame-title">{object.text || object.name}</div>
          </foreignObject>
        </>
      )}
      {hasHtml && (
        <>
          {object.fill && <rect width={object.width} height={object.height} rx={object.type === "sticky" ? 8 : 16} fill={object.fill} />}
          <foreignObject width={object.width} height={object.height}>
            <div className={`cv-foreign cv-foreign-${object.type}`}>
              <TextContent object={object} />
            </div>
          </foreignObject>
        </>
      )}
      {selected && (
        <rect
          className="cv-selection-outline"
          x={-5}
          y={-5}
          width={object.width + 10}
          height={object.height + 10}
          rx={10}
        />
      )}
    </g>
  );
});
