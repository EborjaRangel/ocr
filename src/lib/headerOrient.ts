import { pickHeaderWinner, scoreInstitutoHeader } from "./institutoHeader";

async function scoreOnServer(headerA: Blob, headerB: Blob): Promise<[number, number] | null> {
  const form = new FormData();
  form.append("a", headerA, "a.jpg");
  form.append("b", headerB, "b.jpg");
  const response = await fetch("/api/orient", { method: "POST", body: form });
  if (!response.ok) return null;
  const data = (await response.json()) as { scoreA?: number; scoreB?: number };
  if (typeof data.scoreA !== "number" || typeof data.scoreB !== "number") return null;
  return [data.scoreA, data.scoreB];
}

async function scoreInBrowser(headerA: Blob, headerB: Blob): Promise<[number, number]> {
  const { createWorker, PSM } = await import("tesseract.js");
  const worker = await createWorker("spa", 1, {
    workerPath: "/tesseract/worker.min.js",
    corePath: "/tesseract/tesseract-core-simd-lstm.wasm.js",
    langPath: "/tesseract/lang",
    gzip: true,
    workerBlobURL: false,
  });

  try {
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.SPARSE_TEXT,
      preserve_interword_spaces: "1",
    });
    const textA = (await worker.recognize(headerA)).data.text ?? "";
    const textB = (await worker.recognize(headerB)).data.text ?? "";
    return [scoreInstitutoHeader(textA), scoreInstitutoHeader(textB)];
  } finally {
    await worker.terminate();
  }
}

export async function chooseUprightByInstituto(
  headerA: Blob,
  headerB: Blob,
): Promise<0 | 1> {
  let scores: [number, number] | null = null;
  try {
    scores = await scoreOnServer(headerA, headerB);
  } catch {
    scores = null;
  }
  if (!scores || (scores[0] === 0 && scores[1] === 0)) {
    try {
      scores = await scoreInBrowser(headerA, headerB);
    } catch {
      scores = [0, 0];
    }
  }
  return pickHeaderWinner(scores[0], scores[1]);
}
