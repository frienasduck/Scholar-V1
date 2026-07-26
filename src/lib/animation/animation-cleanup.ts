import type { JSAnimation, Timeline } from "animejs";

export type ScholarAnimeInstance = JSAnimation | Timeline;
export type ScholarAnimationCleanup = () => void;

export function setTemporaryWillChange(elements: Element[], value = "transform, opacity") {
  const previous = elements.map((element) => (element as HTMLElement).style.willChange);
  elements.forEach((element) => {
    (element as HTMLElement).style.willChange = value;
  });
  return () => {
    elements.forEach((element, index) => {
      (element as HTMLElement).style.willChange = previous[index] ?? "";
    });
  };
}

export function cleanupAnimeInstance(
  instance: ScholarAnimeInstance | null | undefined,
  releaseWillChange?: () => void,
  revert = true,
) {
  if (instance) {
    if (revert) instance.revert();
    else instance.cancel();
  }
  releaseWillChange?.();
}

export class ScholarAnimationSlot {
  private cleanup: ScholarAnimationCleanup | null = null;

  replace(next: ScholarAnimationCleanup | null) {
    this.cancel();
    this.cleanup = next;
  }

  cancel() {
    this.cleanup?.();
    this.cleanup = null;
  }
}

export function combineAnimationCleanups(...cleanups: Array<ScholarAnimationCleanup | null | undefined>) {
  return () => {
    cleanups.forEach((cleanup) => cleanup?.());
  };
}
