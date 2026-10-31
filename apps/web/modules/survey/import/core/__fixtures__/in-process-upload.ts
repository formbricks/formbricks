import { fromSurveyImportRefusal, toSurveyImportRefusal } from "../errors";
import { type TSurveyImportUploadRead, readSurveyImportUpload } from "../read-upload";
import { sniffSurveyImportFile } from "../sniff";
import type { TSurveyImportUpload } from "../upload-thread";

/**
 * `openSurveyImportUpload` without the thread, for a test that runs the route under Vitest, which
 * cannot start the app's worker (`upload-worker.test.ts` runs the real one). It reads with the same
 * functions, and crosses the same boundary: what comes back is a structured clone, as `postMessage`
 * makes it, and a refusal is rebuilt from its posted form.
 */
const inTheThread = <T>(run: () => T): T => {
  try {
    return run();
  } catch (error) {
    const refusal = toSurveyImportRefusal(error);
    throw refusal ? fromSurveyImportRefusal(structuredClone(refusal)) : error;
  }
};

const acrossTheThread = <T>(run: () => T): T => structuredClone(inTheThread(run));

export const openSurveyImportUploadInProcess = async (bytes: Uint8Array): Promise<TSurveyImportUpload> => {
  // The thread keeps what it sniffed and posts only its type.
  const sniffed = inTheThread(() => sniffSurveyImportFile(bytes));
  let read: Promise<TSurveyImportUploadRead> | null = null;
  return {
    type: sniffed.type,
    read: (fileName) => {
      read ??= Promise.resolve().then(() => acrossTheThread(() => readSurveyImportUpload(sniffed, fileName)));
      return read;
    },
    close: () => undefined,
  };
};
