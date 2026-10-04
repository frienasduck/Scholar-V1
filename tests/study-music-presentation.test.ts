import { expect, test } from "bun:test";
import { musicControllerPosition, sourceIntersects, youtubeSourcePosition, youtubeSourceSize } from "../src/lib/study-music/player-layout";

test("desktop source remains small, visible and separate at every remembered corner", () => {
  for (const viewport of [{ width: 1440, height: 900, contentLeft: 256 }, { width: 1024, height: 600, contentLeft: 256 }, { width: 844, height: 390, contentLeft: 0 }]) {
    for (const x of [0, 1]) for (const y of [0, 1]) {
      const controllerSize = { width: 356, height: 244 };
      const controller = { ...controllerSize, ...musicControllerPosition(controllerSize, viewport, { x, y }) };
      const size = youtubeSourceSize(viewport, controller.height, false);
      const source = { width: size.width, height: size.height, ...youtubeSourcePosition(size, viewport, controller, false) };
      expect(size.videoHeight).toBe(200);
      expect(size.width - 16).toBeGreaterThanOrEqual(200);
      expect(sourceIntersects(source, controller, 0)).toBe(false);
      expect(source.x).toBeGreaterThanOrEqual(8);
      expect(source.y).toBeGreaterThanOrEqual(72);
      expect(source.x + source.width).toBeLessThanOrEqual(viewport.width);
      expect(source.y + source.height).toBeLessThanOrEqual(viewport.height);
    }
  }
});
test("mobile bottom controller stays compact and the source is never inside it", () => {
  for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 568 }]) {
    for (const height of [67, 157]) {
      const controllerSize = { width: viewport.width - 16, height };
      const controller = { ...controllerSize, ...musicControllerPosition(controllerSize, viewport, { x: 1, y: 0 }) };
      const size = youtubeSourceSize(viewport, height, false);
      const source = { ...size, ...youtubeSourcePosition(size, viewport, controller, false) };
      expect(controller.y + height).toBe(viewport.height - 80);
      expect(sourceIntersects(source, controller, 0)).toBe(false);
      expect(source.y).toBeGreaterThanOrEqual(72);
      expect(source.y + source.height).toBeLessThan(controller.y);
    }
  }
});
test("intentional video expansion fits laptop and short landscape without covering controls", () => {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 1366, height: 768 }, { width: 844, height: 390 }, { width: 640, height: 390 }, { width: 320, height: 568 }]) {
    const controllerSize = { width: viewport.width < 560 ? viewport.width - 16 : 356, height: viewport.width < 768 ? 67 : 244 };
    const controller = { ...controllerSize, ...musicControllerPosition(controllerSize, viewport, { x: 1, y: 1 }, true) };
    const size = youtubeSourceSize(viewport, controller.height, true);
    const source = { ...size, ...youtubeSourcePosition(size, viewport, controller, true) };
    expect(size.videoHeight).toBeGreaterThanOrEqual(200);
    expect(sourceIntersects(source, controller, 0)).toBe(false);
    expect(source.x + source.width).toBeLessThanOrEqual(viewport.width);
    expect(source.y + source.height).toBeLessThanOrEqual(viewport.height);
  }
});
test("controller positions honor remembered corners without letting the header obscure them", () => {
  const size = { width: 356, height: 244 }, viewport = { width: 1440, height: 900 };
  expect(musicControllerPosition(size, viewport, { x: 0, y: 0 })).toEqual({ x: 8, y: 72 });
  expect(musicControllerPosition(size, viewport, { x: 1, y: 1 })).toEqual({ x: 1076, y: 640 });
});
