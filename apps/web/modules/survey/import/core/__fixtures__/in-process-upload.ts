import { fromSurveyImportRefusal, toSurveyImportRefusal } from "../errors";
import { type TSurveyImportUploadRead, readSurveyImportUpload } from "../read-upload";
import { sniffSurveyImportFile } from "../sniff";
import type { TOpenSurveyImportUploadOptions, TSurveyImportUpload } from "../upload-thread";

/**
 * `openSurveyImportUpload` without the thread, for a test that runs the route under Vitest, which
 * cannot start the app's worker (`upload-thread.test.ts` runs the real one). It reads with the same
 * functions, and crosses the same boundary: what comes back is a structured clone, as `postMessage`
 * makes it, and a refusal is rebuilt from its posted form. It keeps the thread's contract too: a closed
 * upload, or one whose client left, reads nothing. An aborted upload rejects, as the thread's does.
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

/** An upload opened in this thread, and whether it was closed, as the route must close each one. */
export interface TInProcessUpload extends TSurveyImportUpload {
  readonly closed: boolean;
}

/** Every upload opened so far; a test empties it before it runs (`openedUploads.length = 0`). */
export const openedUploads: TInProcessUpload[] = [];

export const openSurveyImportUploadInProcess = (
  bytes: Uint8Array,
  { signal }: TOpenSurveyImportUploadOptions = {}
): Promise<TSurveyImportUpload> =>
  // A callback, so an aborted upload rejects rather than throws, as the worker's answer does.
  Promise.resolve().then(() => {
    signal?.throwIfAborted();
    // The thread keeps what it sniffed and posts only its type.
    const sniffed = inTheThread(() => sniffSurveyImportFile(bytes));
    let closed = false;
    let read: Promise<TSurveyImportUploadRead> | null = null;
    const upload: TInProcessUpload = {
      type: sniffed.type,
      get closed() {
        return closed;
      },
      read: (fileName) => {
        if (closed) return Promise.reject(new Error("The survey import's reader was closed"));
        read ??= Promise.resolve()
          .then(() => {
            signal?.throwIfAborted();
            return acrossTheThread(() => readSurveyImportUpload(sniffed, fileName));
          })
          .finally(() => {
            closed = true;
          });
        return read;
      },
      close: () => {
        closed = true;
      },
    };
    openedUploads.push(upload);
    return upload;
  });
