import fs from "fs";
import os from "os";
import path from "path";
import { createWorker, type Worker } from "tesseract.js";

let workerPromise: Promise<Worker> | null = null;
let queue: Promise<void> = Promise.resolve();

async function createSharedWorker(): Promise<Worker> {
  const langPath = path.join(process.cwd(), "public", "tesseract", "lang");
  const localLang = fs.existsSync(path.join(langPath, "spa.traineddata.gz"));
  return createWorker("spa", 1, {
    ...(localLang ? { langPath } : {}),
    gzip: true,
    cachePath: path.join(os.tmpdir(), "tesseract-chatcoyo"),
  });
}

export function withOcrWorker<T>(fn: (worker: Worker) => Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    if (!workerPromise) {
      workerPromise = createSharedWorker().catch((error) => {
        workerPromise = null;
        throw error;
      });
    }
    const worker = await workerPromise;
    return fn(worker);
  });
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}
