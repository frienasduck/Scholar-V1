import "server-only";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import sharp from "sharp";
import { createWorker, OEM, PSM } from "tesseract.js";

export type OcrResult = { text: string; confidence: number; reviewRequired: boolean };
const activeJobs = new Map<string, Promise<OcrResult>>();
let workerPromise: ReturnType<typeof createWorker> | null = null;
const require = createRequire(import.meta.url);

/** One bounded native worker. Language data ships with the app, not a runtime CDN. */
async function recognize(source: Buffer): Promise<OcrResult> {
  let expired = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let worker: Awaited<ReturnType<typeof createWorker>> | undefined;
  const work = async () => {
    const prepared = await sharp(source, { failOn: "error", limitInputPixels: 40_000_000 })
      .rotate().flatten({ background: "white" }).grayscale().normalize()
      .resize({ width: 2200, withoutEnlargement: true }).png().toBuffer();
    if (expired) throw new Error("OCR_TIMEOUT");
    if (!workerPromise) workerPromise = createWorker("eng", OEM.LSTM_ONLY, {
      workerPath: require.resolve("tesseract.js/src/worker-script/node/index.js"),
      langPath: join(dirname(require.resolve("@tesseract.js-data/eng/package.json")), "4.0.0_best_int"),
      cachePath: tmpdir(), cacheMethod: "none",
      errorHandler: () => { workerPromise = null; },
    }).catch(error => { workerPromise = null; throw error; });
    worker = await workerPromise;
    if (expired) { void worker.terminate().catch(() => undefined); throw new Error("OCR_TIMEOUT"); }
    // Automatic layout handles textbook columns; SINGLE_BLOCK loses their reading order.
    await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO, preserve_interword_spaces: "1", user_defined_dpi: "300" });
    const result = await worker.recognize(prepared);
    const text = result.data.text.trim().slice(0, 20_000);
    if (!text) throw new Error("NO_TEXT");
    const confidence = Math.max(0, Math.min(100, Math.round(result.data.confidence)));
    return { text, confidence, reviewRequired: true };
  };
  try {
    return await Promise.race([work(), new Promise<never>((_, reject) => {
      timer = setTimeout(() => { expired = true; reject(new Error("OCR_TIMEOUT")); }, 45_000);
    })]);
  } catch (error) {
    if (worker) void worker.terminate().catch(() => undefined);
    workerPromise = null;
    throw error;
  } finally { if (timer) clearTimeout(timer); }
}

export async function recognizePageImage(source: Buffer) {
  const id = createHash("sha256").update(source).digest("hex");
  let job = activeJobs.get(id);
  if (!job) {
    if (activeJobs.size) throw new Error("OCR_BUSY");
    job = recognize(source).finally(() => activeJobs.delete(id));
    activeJobs.set(id, job);
  }
  return job;
}

/** Test/process shutdown only. Never called while another request owns the worker. */
export async function disposeOcrWorker() {
  const pending = workerPromise; workerPromise = null;
  if (pending) await pending.then(worker => worker.terminate()).catch(() => undefined);
}
