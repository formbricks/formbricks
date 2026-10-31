import "server-only";
import { MessageChannel, type MessagePort, Worker, receiveMessageOnPort } from "node:worker_threads";
import { SURVEY_IMPORT_MAX_READ_THREADS, SURVEY_IMPORT_READ_TIME_MS } from "../limits";
import type { TSurveyImportFileLimit } from "../types";
import { SurveyImportInputError, fromSurveyImportRefusal } from "./errors";
import type { TSurveyImportUploadRead } from "./read-upload";
import type { TSurveyImportFile } from "./sniff";
import type { TUploadWorkerFailure, TUploadWorkerReply, TUploadWorkerRequest } from "./upload-worker";

/**
 * The upload's own thread. Telling a file's type and reading it is synchronous work that grows with the
 * file: parsing a 15 MiB JSON upload of a million small objects and walking it holds a thread for about
 * half a second, a large spreadsheet or Word part longer. On the web server's thread that is half a
 * second in which no other request on the pod is answered, so each upload is sniffed and read in a
 * worker thread of its own (`upload-worker.ts`), and only what its lane reads comes back: the parsed file
 * never crosses, since cloning a million objects across costs more than parsing them did.
 *
 * The thread is held to a time limit (`SURVEY_IMPORT_READ_TIME_MS`): a file that takes longer is refused
 * with a 422 naming the limit, and the thread ends, its memory with it. A thread that could not start or
 * failed is an error, answered as a 500.
 *
 * It has no heap limit of its own (`resourceLimits`) on purpose. Node ends a worker that reaches one only
 * where V8 can stop its JavaScript: past the limit inside a native allocation — `structuredClone`, which
 * the Formbricks file's reader runs on the whole file, is one — V8 aborts the process instead, so a capped
 * thread would let a hostile file crash the server. Its heap is the process's (`--max-old-space-size`),
 * as the server's own thread's is, and what a file can make it hold is bounded by the upload's limits
 * (see `SURVEY_IMPORT_MAX_IN_FLIGHT`). One that still runs out where V8 can stop it ends the thread and
 * is refused like a slow one; anywhere else it aborts the process, as it would on the server's thread.
 *
 * It answers in two steps, so a lane is charged its rate limit and held to the AI gate before its file
 * is read (`runSurveyImportLane`): `openSurveyImportUpload` tells the type, and the upload's `read` reads
 * it for the lane. The thread lives from one to the other.
 *
 * A process runs `SURVEY_IMPORT_MAX_READ_THREADS` of them at once, and the next upload waits its turn.
 * Threads that run at once also hold their files at once: three of the costliest JSON uploads read side
 * by side peaked at about 1.9 GB of RSS, one after the other at 1.2 GB, against the web pod's 2 GiB. A
 * read takes a couple of seconds at the most, and the import slots (`SURVEY_IMPORT_MAX_IN_FLIGHT`) bound
 * how many wait.
 */

/** An upload being read in its thread. */
export interface TSurveyImportUpload {
  readonly type: TSurveyImportFile["type"];
  /** Read the upload for its lane, once. The thread ends with the answer. */
  read: (fileName: string) => Promise<TSurveyImportUploadRead>;
  /** End the thread, if it still runs. Safe to call at any time, and more than once. */
  close: () => void;
}

/** `workerUrl` runs another build of `upload-worker.ts` — a test's bundle; the app's own by default. */
export interface TOpenSurveyImportUploadOptions {
  workerUrl?: URL;
}

const tooCostly = (identifier: Extract<TSurveyImportFileLimit, "read_time" | "read_memory">) =>
  new SurveyImportInputError(
    [
      {
        name: "file",
        reason:
          identifier === "read_time"
            ? `The file must be readable within ${SURVEY_IMPORT_READ_TIME_MS / 1000} seconds`
            : "The file needs more memory to read than the server has for it",
        code: "file_limit_exceeded",
        identifier,
      },
    ],
    "The file is past one of the import's limits."
  );

/** The read threads running now, and the uploads waiting for one, first come first served. */
let readThreads = 0;
const waitingForThread: (() => void)[] = [];

/** Wait for a turn to run a read thread; the function it resolves to gives the turn back, once. */
const takeReadThread = async (): Promise<() => void> => {
  if (readThreads < SURVEY_IMPORT_MAX_READ_THREADS) readThreads += 1;
  else await new Promise<void>((resolve) => waitingForThread.push(resolve));

  let given = false;
  return () => {
    if (given) return;
    given = true;
    // Handed straight to the next upload, so a newcomer cannot take it in between.
    const next = waitingForThread.shift();
    if (next) next();
    else readThreads -= 1;
  };
};

const fromFailure = ({ name, message, stack }: TUploadWorkerFailure): Error =>
  Object.assign(new Error(message), { name, stack });

const startWorker = (port: MessagePort, workerUrl: URL | undefined): Worker => {
  const options = { workerData: { port }, transferList: [port] };
  // Written out in full: the bundler builds the worker from this exact expression.
  const worker = workerUrl
    ? new Worker(workerUrl, options)
    : new Worker(new URL("./upload-worker.ts", import.meta.url), options);
  // The request in flight keeps the server up; the thread must never do so on its own.
  worker.unref();
  return worker;
};

/**
 * The buffer to hand the thread instead of copying it, when `bytes` is all of one: transferring a view
 * into a larger buffer would take the rest of it away too.
 */
const transferable = (bytes: Uint8Array): ArrayBuffer[] =>
  bytes.buffer instanceof ArrayBuffer &&
  bytes.byteOffset === 0 &&
  bytes.byteLength === bytes.buffer.byteLength
    ? [bytes.buffer]
    : [];

/**
 * Sniff `bytes` in a thread of their own, and keep the thread for the lane's read. The buffer is
 * transferred when `bytes` is all of it, so `bytes` is then empty. Throws the sniffer's refusals (`toRefusalResponse` maps
 * them), the read's own when past its limits, and an error when the thread fails.
 */
export const openSurveyImportUpload = async (
  bytes: Uint8Array,
  { workerUrl }: TOpenSurveyImportUploadOptions = {}
): Promise<TSurveyImportUpload> => {
  const giveTurnBack = await takeReadThread();
  const { port1: port, port2 } = new MessageChannel();
  port.unref();
  let worker: Worker;
  try {
    worker = startWorker(port2, workerUrl);
  } catch (error) {
    port.close();
    giveTurnBack();
    throw error;
  }

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    port.close();
    void worker.terminate();
    giveTurnBack();
  };
  // A thread that fails between two requests ends there; the next request is answered by `read`'s check.
  worker.on("error", close);

  /** One request and its answer, within the time limit. Any end but an answer ends the thread too. */
  const ask = (request: TUploadWorkerRequest, transfer: ArrayBuffer[] = []): Promise<unknown> =>
    new Promise((resolve, reject) => {
      const settle = (outcome: () => void) => {
        clearTimeout(timer);
        port.off("message", onReply);
        worker.off("error", onError);
        worker.off("exit", onExit);
        outcome();
      };
      const onReply = (reply: TUploadWorkerReply) =>
        settle(() => {
          if (reply.ok) return resolve(reply.value);
          close();
          reject("refusal" in reply ? fromSurveyImportRefusal(reply.refusal) : fromFailure(reply.failure));
        });
      const fail = (error: Error) =>
        settle(() => {
          close();
          reject(error);
        });
      const onError = (error: Error & { code?: string }) =>
        fail(error.code === "ERR_WORKER_OUT_OF_MEMORY" ? tooCostly("read_memory") : error);
      const onExit = (code: number) => fail(new Error(`The survey import's reader exited with ${code}`));
      const timer = setTimeout(() => {
        // The answer may be waiting behind a busy thread here: read it before blaming the file.
        const pending = receiveMessageOnPort(port);
        if (pending) onReply(pending.message as TUploadWorkerReply);
        else fail(tooCostly("read_time"));
      }, SURVEY_IMPORT_READ_TIME_MS);

      port.on("message", onReply);
      worker.on("error", onError);
      worker.on("exit", onExit);
      port.postMessage(request, transfer);
    });

  let type: TSurveyImportFile["type"];
  try {
    type = (await ask({ step: "sniff", bytes }, transferable(bytes))) as TSurveyImportFile["type"];
  } catch (error) {
    close();
    throw error;
  }

  let read: Promise<TSurveyImportUploadRead> | null = null;
  return {
    type,
    read: (fileName) => {
      if (closed) return Promise.reject(new Error("The survey import's reader was closed"));
      read ??= (ask({ step: "read", fileName }) as Promise<TSurveyImportUploadRead>).finally(close);
      return read;
    },
    close,
  };
};

/**
 * Read `upload` for the lane its type picked. The thread read what it sniffed, so the read is always of
 * that type; anything else is a broken thread, not a file to refuse.
 */
export const readSurveyImportUploadAs = async <TType extends TSurveyImportUploadRead["type"]>(
  upload: TSurveyImportUpload,
  type: TType,
  fileName: string
): Promise<Extract<TSurveyImportUploadRead, { type: TType }>> => {
  const read = await upload.read(fileName);
  if (read.type !== type) throw new Error(`The upload was read as ${read.type}, not ${type}`);
  return read as Extract<TSurveyImportUploadRead, { type: TType }>;
};
