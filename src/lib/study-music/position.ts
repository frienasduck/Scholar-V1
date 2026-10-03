export type Position = { x: number; y: number };
export type Bounds = { width: number; height: number; viewportWidth: number; viewportHeight: number; bottomInset?: number };
export function clampPosition(pos: Position, b: Bounds): Position {
  const maxX = Math.max(8, b.viewportWidth - b.width - 8);
  const maxY = Math.max(8, b.viewportHeight - b.height - (b.bottomInset ?? 20));
  return { x: Math.min(maxX, Math.max(8, pos.x)), y: Math.min(maxY, Math.max(8, pos.y)) };
}
export function restorePosition(pos: Position, b: Bounds): Position {
  return clampPosition({ x: pos.x * Math.max(0, b.viewportWidth - b.width - 16) + 8, y: pos.y * Math.max(0, b.viewportHeight - b.height - (b.bottomInset ?? 20) - 8) + 8 }, b);
}
export function normalizePosition(pos: Position, b: Bounds): Position {
  const p = clampPosition(pos, b);
  return { x: Math.min(1, Math.max(0, (p.x - 8) / Math.max(1, b.viewportWidth - b.width - 16))), y: Math.min(1, Math.max(0, (p.y - 8) / Math.max(1, b.viewportHeight - b.height - (b.bottomInset ?? 20) - 8))) };
}
export function snapPosition(pos: Position, b: Bounds): Position {
  const right = pos.x + b.width / 2 > b.viewportWidth / 2;
  const bottom = pos.y + b.height / 2 > b.viewportHeight / 2;
  return restorePosition({ x: right ? 1 : 0, y: bottom ? 1 : 0 }, b);
}
