export interface BrowserStartupProfile {
  mobile: boolean;
  saveData: boolean;
  slowConnection: boolean;
  reducedMotion: boolean;
  concurrency: number;
}

interface NavigatorConnection {
  saveData?: boolean;
  effectiveType?: string;
}

export function getBrowserStartupProfile(): BrowserStartupProfile {
  const connection = (navigator as Navigator & { connection?: NavigatorConnection }).connection;
  const mobile = matchMedia("(pointer: coarse)").matches || window.innerWidth < 768;
  const saveData = connection?.saveData === true;
  const slowConnection =
    connection?.effectiveType === "slow-2g" ||
    connection?.effectiveType === "2g" ||
    connection?.effectiveType === "3g";
  return {
    mobile,
    saveData,
    slowConnection,
    reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
    concurrency: mobile ? 2 : 4,
  };
}

export function abortError(): DOMException {
  return new DOMException("Startup preparation was cancelled", "AbortError");
}

export async function withTaskTimeout<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  parentSignal: AbortSignal,
): Promise<T> {
  if (parentSignal.aborted) throw abortError();
  const controller = new AbortController();
  const relayAbort = () => controller.abort();
  parentSignal.addEventListener("abort", relayAbort, { once: true });
  const timeout = window.setTimeout(() => controller.abort("timeout"), timeoutMs);
  try {
    return await Promise.race([
      operation(controller.signal),
      new Promise<never>((_resolve, reject) => {
        controller.signal.addEventListener(
          "abort",
          () => reject(abortError()),
          { once: true },
        );
      }),
    ]);
  } finally {
    window.clearTimeout(timeout);
    parentSignal.removeEventListener("abort", relayAbort);
  }
}

export async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
  signal: AbortSignal,
): Promise<void> {
  let nextIndex = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (nextIndex < items.length) {
      if (signal.aborted) throw abortError();
      const item = items[nextIndex++];
      await worker(item);
    }
  });
  await Promise.all(runners);
}

export function waitForAnimationFrames(count: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    let remaining = Math.max(1, count);
    let frame = 0;
    const onAbort = () => {
      cancelAnimationFrame(frame);
      reject(abortError());
    };
    const step = () => {
      if (signal.aborted) return onAbort();
      remaining -= 1;
      if (remaining <= 0) {
        signal.removeEventListener("abort", onAbort);
        resolve();
        return;
      }
      frame = requestAnimationFrame(step);
    };
    signal.addEventListener("abort", onAbort, { once: true });
    frame = requestAnimationFrame(step);
  });
}

export async function preloadAndDecodeImage(url: string, signal: AbortSignal): Promise<void> {
  if (signal.aborted) throw abortError();
  const image = new Image();
  image.decoding = "async";
  const loaded = new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      image.onload = null;
      image.onerror = null;
      signal.removeEventListener("abort", onAbort);
    };
    const onAbort = () => {
      cleanup();
      image.src = "";
      reject(abortError());
    };
    image.onload = () => {
      cleanup();
      resolve();
    };
    image.onerror = () => {
      cleanup();
      reject(new Error(`Image could not be prepared: ${url}`));
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
  image.src = url;
  await loaded;
  if (typeof image.decode === "function") await image.decode().catch(() => undefined);
}

export async function preloadVideoFirstFrame(url: string, signal: AbortSignal): Promise<void> {
  if (signal.aborted) throw abortError();
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  await new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      video.removeEventListener("loadeddata", onReady);
      video.removeEventListener("canplay", onReady);
      video.removeEventListener("error", onError);
      signal.removeEventListener("abort", onAbort);
    };
    const onReady = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("Background video could not be prepared"));
    };
    const onAbort = () => {
      cleanup();
      reject(abortError());
    };
    video.addEventListener("loadeddata", onReady, { once: true });
    video.addEventListener("canplay", onReady, { once: true });
    video.addEventListener("error", onError, { once: true });
    signal.addEventListener("abort", onAbort, { once: true });
    video.src = url;
    video.load();
  }).finally(() => {
    video.pause();
    video.removeAttribute("src");
    video.load();
  });
}

export async function warmCurrentScrollSurface(signal: AbortSignal): Promise<void> {
  const scrollRoot = document.getElementById("main-scroll");
  if (!scrollRoot) {
    await waitForAnimationFrames(2, signal);
    return;
  }

  scrollRoot.dataset.startupWarmup = "active";
  try {
    const candidates = Array.from(
      scrollRoot.querySelectorAll<HTMLElement>(
        ":scope > div, main, section, article, [data-startup-section]",
      ),
    ).slice(0, 40);
    const batchSize = getBrowserStartupProfile().mobile ? 4 : 8;
    for (let index = 0; index < candidates.length; index += batchSize) {
      if (signal.aborted || document.hidden) throw abortError();
      const batch = candidates.slice(index, index + batchSize);
      // Reading geometry once per controlled batch materialises layout without moving real scroll.
      batch.forEach((element) => {
        void element.offsetTop;
        void element.offsetHeight;
      });
      await waitForAnimationFrames(1, signal);
    }

    const images = Array.from(scrollRoot.querySelectorAll<HTMLImageElement>("img"))
      .filter((image) => image.currentSrc || image.src)
      .slice(0, getBrowserStartupProfile().mobile ? 6 : 12);
    await runWithConcurrency(
      images,
      getBrowserStartupProfile().concurrency,
      async (image) => {
        if (!image.complete) {
          await new Promise<void>((resolve) => {
            const settle = () => {
              image.removeEventListener("load", settle);
              image.removeEventListener("error", settle);
              signal.removeEventListener("abort", settle);
              resolve();
            };
            image.addEventListener("load", settle, { once: true });
            image.addEventListener("error", settle, { once: true });
            signal.addEventListener("abort", settle, { once: true });
          });
        }
        if (typeof image.decode === "function") await image.decode().catch(() => undefined);
      },
      signal,
    );
  } finally {
    delete scrollRoot.dataset.startupWarmup;
    scrollRoot.scrollTop = 0;
  }
}
