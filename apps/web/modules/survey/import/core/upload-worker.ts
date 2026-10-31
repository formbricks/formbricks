import { type MessagePort, workerData } from "node:worker_threads";
import { type TSurveyImportRefusal, toSurveyImportRefusal } from "./errors";
import { readSurveyImportUpload } from "./read-upload";
import { type TSurveyImportFile, sniffSurveyImportFile } from "./sniff";

/**
 * Worker side of the upload's thread (`upload-thread.ts`). It sniffs the bytes it is sent and keeps
 * what it sniffed, then reads it for its lane when asked, so the parsed file stays in this thread and
 * only the lane's bounded read is posted back. Nothing here may load server code (the database, the
 * AI SDK, `server-only`): `upload-worker.test.ts` bundles this file and runs it in a real thread.
 */

export type TUploadWorkerRequest = { step: "sniff"; bytes: Uint8Array } | { step: "read"; fileName: string };

/** An error that is not a refusal, as far as a structured clone carries it. */
export interface TUploadWorkerFailure {
  name: string;
  message: string;
  stack?: string;
}

export type TUploadWorkerReply =
  | { ok: true; value: unknown }
  | { ok: false; refusal: TSurveyImportRefusal }
  | { ok: false; failure: TUploadWorkerFailure };

const toReply = (error: unknown): TUploadWorkerReply => {
  const refusal = toSurveyImportRefusal(error);
  if (refusal) return { ok: false, refusal };
  const { name, message, stack } = error instanceof Error ? error : new Error(String(error));
  return { ok: false, failure: { name, message, stack } };
};

export const serveSurveyImportUpload = (port: MessagePort): void => {
  let upload: TSurveyImportFile | null = null;

  const answer = (run: () => unknown) => {
    try {
      // Posting clones the value, which throws for one that cannot be cloned: answered as a failure too.
      port.postMessage({ ok: true, value: run() } satisfies TUploadWorkerReply);
    } catch (error) {
      port.postMessage(toReply(error));
    }
  };

  port.on("message", (request: TUploadWorkerRequest) => {
    if (request.step === "sniff") {
      answer(() => {
        upload = sniffSurveyImportFile(request.bytes);
        return upload.type;
      });
      return;
    }
    answer(() => {
      if (!upload) throw new Error("The upload's worker was asked to read before it sniffed");
      const sniffed = upload;
      upload = null;
      return readSurveyImportUpload(sniffed, request.fileName);
    });
  });
};

// Started by `upload-thread.ts`, it serves the port it was given. Imported anywhere else (a test), there
// is no port, and it only exports `serveSurveyImportUpload`.
const workerPort = (workerData as { port?: MessagePort } | null)?.port;
if (workerPort) serveSurveyImportUpload(workerPort);
