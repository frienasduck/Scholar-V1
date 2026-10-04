import { restorePosition, type Position } from "./position";

export type PlayerRect = { x: number; y: number; width: number; height: number };
export type PlayerViewport = { width: number; height: number; contentLeft?: number };
export const sourceIntersects = (a: PlayerRect, b: PlayerRect, gap = 12) => a.x < b.x + b.width + gap && a.x + a.width + gap > b.x && a.y < b.y + b.height + gap && a.y + a.height + gap > b.y;

/** The music controller and official source are siblings, never overlapping. */
export function musicControllerPosition(size: { width: number; height: number }, viewport: PlayerViewport, remembered: Position, videoExpanded = false): Position {
  const mobile = viewport.width < 768;
  const bottomInset = mobile && viewport.height >= 500 ? 80 : 16;
  const sideBySide = viewport.height < 620 && viewport.width >= 560;
  const position = restorePosition(mobile ? { x: .5, y: 1 } : remembered, { ...size, viewportWidth: viewport.width, viewportHeight: viewport.height, bottomInset });
  if (sideBySide && (videoExpanded || mobile)) position.x = 8;
  if (videoExpanded || mobile) position.y = Math.max(72, viewport.height - bottomInset - size.height);
  return { ...position, y: Math.max(72, position.y) };
}

export function youtubeSourceSize(viewport: PlayerViewport, controllerHeight: number, expanded: boolean) {
  const mobile = viewport.width < 768;
  const sideBySide = viewport.height < 620 && viewport.width >= 560;
  const width = expanded
    ? Math.max(216, Math.min(sideBySide ? viewport.width - 396 : viewport.width - 16, 720))
    : mobile ? 228 : 264;
  const availableHeight = sideBySide ? viewport.height - 112 : viewport.height - controllerHeight - (mobile ? 180 : 140);
  const videoHeight = expanded ? Math.max(200, Math.min((width - 16) * 9 / 16, availableHeight)) : 200;
  return { width, videoHeight, height: videoHeight + 40 };
}

export function youtubeSourcePosition(size: { width: number; height: number }, viewport: PlayerViewport, controller: PlayerRect, expanded: boolean): Position {
  const right = Math.max(8, viewport.width - size.width - 8), top = 72;
  const bottom = Math.max(top, viewport.height - size.height - 16);
  const sideBySide = viewport.height < 620 && viewport.width >= 560;
  if (sideBySide && (expanded || viewport.width < 768)) return { x: right, y: bottom };
  if (viewport.width < 768) return { x: right, y: Math.max(top, controller.y - size.height - 12) };
  if (expanded) return { x: Math.max(8, (viewport.width - size.width) / 2), y: top };
  const left = Math.min(right, Math.max(8, (viewport.contentLeft ?? 0) + 12));
  const opposite = controller.x + controller.width / 2 > viewport.width / 2 ? left : right;
  const same = opposite === left ? right : left;
  const candidates = [{ x: opposite, y: bottom }, { x: opposite, y: top }, { x: same, y: top }, { x: same, y: bottom }];
  return candidates.find(p => !sourceIntersects({ ...p, ...size }, controller)) ?? candidates[0];
}
