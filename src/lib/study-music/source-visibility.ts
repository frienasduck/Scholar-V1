type SourceRect = { width: number; height: number; top: number; left: number; right: number; bottom: number };
export function sourcePlaybackAllowed(rect: SourceRect, viewport: { width: number; height: number }, unobscured: boolean): boolean {
  if (!unobscured || rect.width < 200 || rect.height < 200) return false;
  const width = Math.max(0, Math.min(rect.right, viewport.width) - Math.max(0, rect.left));
  const height = Math.max(0, Math.min(rect.bottom, viewport.height) - Math.max(0, rect.top));
  return width >= 200 && height >= 200 && width * height > rect.width * rect.height / 2;
}
