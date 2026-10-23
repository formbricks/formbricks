import "server-only";
import { MessageChannel, type MessagePort, Worker, receiveMessageOnPort } from "node:worker_threads";
import { logger } from "@formbricks/logger";
import type { SamlDecryption, SamlIdpVerification } from "@/modules/ee/auth/saml/lib/saml-parse-worker";
import type { SamlDecryptedRefusal } from "@/modules/ee/auth/saml/lib/saml-response-bounds";

/**
 * Longest a SAMLResponse may take to parse before jackson sees it (ENG-3973).
 *
 * `checkSamlResponseBounds` is the cheap first gate, but it models xmldom from the outside, and a shape it misreads
 * is a way back to a slow parse. This gate does not model anything: a worker thread parses the response the way
 * `@boxyhq/saml20` does, runs saml20's `parseIssuer` as jackson does first, and is terminated if it runs past the
 * budget. A response that passes is then processed again by jackson on this thread, so what this bounds is jackson's
 * cost per response: no response slower than the budget reaches jackson, whatever its shape.
 *
 * The worker also runs saml20's signature check (ENG-4108), with the configured connection's IdP certificates, as
 * jackson will: saml20 tries them one by one, the whole check each time, so a connection with several (a rollover)
 * costs several times as much when none matches. That check is most of the time measured: canonicalizing and
 * digesting the signed document costs far more than parsing it. The largest real response the byte bounds admit (862
 * verbose Okta groups, 255 KiB) takes ~77 ms with one certificate and ~140 ms with two (Node 26.4, arm64 laptop,
 * warm); a slower host takes longer. The budget has to let that through, and it is one figure for every connection,
 * however many certificates it lists, so one response holds jackson's thread for at most ~1.4 times it (see
 * `JACKSON_COST_PER_WORKER_MS`) whatever the configuration.
 *
 * An encrypted assertion is ciphertext to the byte bounds, and jackson decrypts it and parses the plaintext before it
 * checks any signature (ENG-4051). Given the SP key, the worker does the same within the same budget: the outer parse,
 * the decryption and the plaintext's parse all count. A plaintext of nested namespace scopes that would block jackson
 * for ~1-3 s is cut off here, and a real one (500 groups) takes ~5-20 ms. The worker then holds the decrypted document
 * to the same byte bounds as an unencrypted response (`checkDecryptedSamlResponseBounds`): a flood of cheap elements
 * parses well within the budget, but jackson's later passes over it cost several times as much. An encrypted assertion
 * that will not decrypt goes on to jackson, which fails it the same way (see `takeResult`).
 */
export const SAML_PARSE_TIME_BUDGET_MS = 250;

/**
 * Jobs that may wait for the worker. One parse runs at a time, so a flood that fills the queue is refused at once
 * rather than queued behind itself. The per-IP limit in front of this keeps one caller from filling it, but only
 * behind a trusted proxy: without one every caller shares an identity and the limit is skipped, so the queue bound is
 * what remains.
 */
export const SAML_PARSE_QUEUE_LIMIT = 16;

/**
 * Heap for the worker. A response within the markup budget builds a DOM of a few MB; a parse that tries to grow past
 * this ends the worker, not the server.
 */
const WORKER_RESOURCE_LIMITS = { maxOldGenerationSizeMb: 64, maxYoungGenerationSizeMb: 16 };

/** How long a new worker may take to load xmldom, warm up and report ready before it is treated as failed. */
const WORKER_STARTUP_TIMEOUT_MS = 5_000;

/**
 * Main-thread parse time the SAML callback may spend per second, per process. A response that passes the budget is
 * then processed by jackson on this thread (its issuer parse, decryption, two xml2js passes and the signature check),
 * so each one is charged its worker-measured time times `JACKSON_COST_PER_WORKER_MS`. Past the allowance the callback
 * answers 503 rather than let many sources together keep the event loop busy with SAML. It is checked when a response
 * is queued and again when its parse finishes, so a burst can overdraw it by one response at most. A real sign-in
 * costs ~12 ms in the worker with 150 groups and ~77 ms at the largest the bounds admit, so this is about a dozen
 * sign-ins a second per process, or two of the largest.
 */
export const SAML_MAIN_THREAD_PARSE_ALLOWANCE_MS = 300;

/**
 * jackson's main-thread time per millisecond the worker measured. The worker runs saml20's signature check as well
 * (ENG-4108), the dearest of jackson's passes, so its time tracks jackson's: measured on Node 26.4, jackson's XML work
 * (`parseIssuer` then `validate`) took 1.0-1.4 times the worker's time on real signed responses (150-500 groups,
 * plain and encrypted) and on the costliest shapes the bounds let through (element floods, wide signed references).
 * Before the worker ran the signature check that was 8-18 times. 2 leaves room for jackson's work around the XML.
 */
export const JACKSON_COST_PER_WORKER_MS = 2;

/** What the worker read from the response: identifiers only, for logging. All of it is unauthenticated. */
export interface SamlResponseClaims {
  issuer?: string;
  id?: string;
  inResponseTo?: string;
}

export type SamlParseProbe =
  | { outcome: "parsed"; ms: number; claims: SamlResponseClaims }
  /** It ran past the time budget or the worker's heap limit. */
  | { outcome: "too_costly"; reason: "time" | "memory" }
  /** Its decrypted assertion, put in place, is past the byte bounds jackson's later passes are sized for. */
  | { outcome: "refused"; refusal: SamlDecryptedRefusal }
  /**
   * The queue was full, or this process has spent its parse allowance for now, either before the job was queued or
   * by the time the worker answered; the response does not reach jackson.
   */
  | { outcome: "busy" }
  /** The worker could not start or died (out of memory, a crash); nothing is known about the response. */
  | { outcome: "failed" };

interface Job {
  id: number;
  xml: string;
  /** The SP private key, so the worker can decrypt an encrypted assertion as jackson will; `null` when jackson won't. */
  decryptionKey: string | null;
  /** What jackson checks the signature with, so the worker can time that check as jackson will run it. */
  idpVerification: SamlIdpVerification | null;
  resolve: (probe: SamlParseProbe) => void;
}

interface WorkerHandle {
  worker: Worker;
  /** Answers come over this port rather than the worker's own, so a stalled thread can still read them on time. */
  port: MessagePort;
}

interface WorkerResult {
  id: number;
  /** How long the parse took, measured in the worker, so a busy main thread does not count against the response. */
  ms: number;
  claims: SamlResponseClaims;
  /** How its encrypted assertion fared, when it holds one jackson would decrypt. */
  decryption?: SamlDecryption;
}

interface Pool {
  handle: WorkerHandle | null;
  ready: Promise<WorkerHandle> | null;
  /** The job holding the worker. Claimed before the worker is ready, so only one job is ever dispatched. */
  running: (Job & { dispatched?: boolean; timer?: NodeJS.Timeout }) | null;
  queue: Job[];
  nextId: number;
  /** Main-thread parse time left in the current allowance, and when it was last topped up. */
  allowanceMs: number;
  allowanceAt: number;
}

declare global {
  // Kept on the global object so a `next dev` reload of this module reuses the pool instead of leaking a worker.
  var samlParsePool: Pool | undefined;
}

globalThis.samlParsePool ??= {
  handle: null,
  ready: null,
  running: null,
  queue: [],
  nextId: 0,
  allowanceMs: SAML_MAIN_THREAD_PARSE_ALLOWANCE_MS,
  allowanceAt: 0,
};
const pool = globalThis.samlParsePool;

const settleRunning = (probe: SamlParseProbe) => {
  const job = pool.running;
  if (!job) return;
  if (job.timer) clearTimeout(job.timer);
  pool.running = null;
  job.resolve(probe);
  pump();
};

/** Tops up the main-thread parse allowance for the time passed, up to one second's worth. */
const refillAllowance = (now: number) => {
  const elapsed = now - pool.allowanceAt;
  pool.allowanceAt = now;
  pool.allowanceMs = Math.min(
    SAML_MAIN_THREAD_PARSE_ALLOWANCE_MS,
    pool.allowanceMs + (elapsed * SAML_MAIN_THREAD_PARSE_ALLOWANCE_MS) / 1000
  );
};

/**
 * Settle the running job with `result` if it is that job's answer; a stale answer from an older job is ignored. The
 * allowance is checked again here, not only when the job was queued: every job in a full queue was accepted while
 * the allowance was still positive, so a burst would otherwise all reach jackson at once. Here only the job that
 * spends the allowance does, and the rest answer busy.
 */
const takeResult = (result: WorkerResult): boolean => {
  const job = pool.running;
  if (!job?.dispatched || result.id !== job.id) return false;
  if (result.ms > SAML_PARSE_TIME_BUDGET_MS) {
    settleRunning({ outcome: "too_costly", reason: "time" });
    return true;
  }
  // An encrypted assertion that did not decrypt is not refused here. jackson decrypts with the same saml20 and the same
  // key (read from the x509 copy it initialised), so it fails the response the same way, and the failed attempt it
  // repeats is what the worker just timed and is charged for below. Refusing it with an answer of its own would tell
  // an anonymous sender which ciphertexts decrypt, the signal attacks on XML Encryption rely on; failed decryptions
  // and failed signature checks have to look alike from outside.
  if (result.decryption?.decrypted && result.decryption.refusal) {
    settleRunning({ outcome: "refused", refusal: result.decryption.refusal });
    return true;
  }
  refillAllowance(performance.now());
  if (pool.allowanceMs <= 0) {
    settleRunning({ outcome: "busy" });
    return true;
  }
  pool.allowanceMs -= result.ms * JACKSON_COST_PER_WORKER_MS;
  settleRunning({ outcome: "parsed", ms: result.ms, claims: result.claims });
  return true;
};

const discardWorker = (handle: WorkerHandle) => {
  if (pool.handle !== handle) return;
  pool.handle = null;
  pool.ready = null;
  handle.port.close();
  void handle.worker.terminate();
};

/**
 * A new worker thread, or `null` when it could not be created at all (ERR_WORKER_INIT_FAILED under thread or memory
 * pressure), which is logged here.
 */
const createWorker = (): WorkerHandle | null => {
  try {
    const { port1, port2 } = new MessageChannel();
    const worker = new Worker(new URL("./saml-parse-worker.ts", import.meta.url), {
      resourceLimits: WORKER_RESOURCE_LIMITS,
      workerData: { port: port2 },
      transferList: [port2],
    });
    // A background thread must never keep the server process alive on its own.
    worker.unref();
    port1.unref();
    return { worker, port: port1 };
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "SAML parse worker could not start"
    );
    return null;
  }
};

/** Resolves once `handle`'s worker has warmed up and reported ready; rejects if it fails first. */
const whenReady = (handle: WorkerHandle): Promise<WorkerHandle> => {
  const { worker, port } = handle;
  return new Promise<WorkerHandle>((resolve, reject) => {
    let ready = false;
    const onFailure = (error: Error | number) => {
      clearTimeout(startup);
      if (pool.handle !== handle) return;
      discardWorker(handle);
      // Running out of heap mid-job is the response's cost, not a fault of the server.
      if ((error as { code?: unknown }).code === "ERR_WORKER_OUT_OF_MEMORY" && pool.running?.dispatched) {
        reject(error as Error);
        settleRunning({ outcome: "too_costly", reason: "memory" });
        return;
      }
      logger.error(
        { error: error instanceof Error ? error.message : `exit ${error}` },
        "SAML parse worker stopped"
      );
      reject(error instanceof Error ? error : new Error(`SAML parse worker exited with ${error}`));
      // A worker that never became ready fails everything waiting for it, rather than each job starting another
      // worker and waiting out the same startup in turn.
      const waiting = ready ? [] : pool.queue.splice(0);
      settleRunning({ outcome: "failed" });
      for (const queued of waiting) queued.resolve({ outcome: "failed" });
    };
    const startup = setTimeout(
      () => onFailure(new Error("SAML parse worker did not start")),
      WORKER_STARTUP_TIMEOUT_MS
    );

    port.on("message", (message: { ready?: true } & Partial<WorkerResult>) => {
      if (message.ready) {
        clearTimeout(startup);
        ready = true;
        resolve(handle);
        return;
      }
      takeResult(message as WorkerResult);
    });
    worker.on("error", onFailure);
    worker.on("exit", onFailure);
  });
};

/** Runs the next queued job, if the worker is free. Never throws: every failure settles the job as `failed`. */
function pump(): void {
  if (pool.running) return;
  const job = pool.queue.shift();
  if (!job) return;
  pool.running = job;

  if (!pool.ready) {
    const handle = createWorker();
    if (!handle) {
      settleRunning({ outcome: "failed" });
      return;
    }
    pool.handle = handle;
    pool.ready = whenReady(handle);
  }

  pool.ready.then(
    (handle) => {
      if (pool.running !== job) return;
      const timer = setTimeout(() => {
        // The answer may already be waiting behind a busy main thread: read it before blaming the response.
        for (
          let pending = receiveMessageOnPort(handle.port);
          pending;
          pending = receiveMessageOnPort(handle.port)
        ) {
          if (takeResult(pending.message as WorkerResult)) return;
        }
        // Terminating stops xmldom mid-parse: it is plain JavaScript, which V8 interrupts at once.
        discardWorker(handle);
        settleRunning({ outcome: "too_costly", reason: "time" });
      }, SAML_PARSE_TIME_BUDGET_MS);
      pool.running = { ...job, dispatched: true, timer };
      handle.port.postMessage({
        id: job.id,
        xml: job.xml,
        decryptionKey: job.decryptionKey,
        idpVerification: job.idpVerification,
      });
    },
    () => {
      // Settled by the worker's failure handler already; this only guards a job left waiting on a failed start.
      if (pool.running === job) settleRunning({ outcome: "failed" });
    }
  );
}

/**
 * Parse `samlResponseBase64` in the worker under `SAML_PARSE_TIME_BUDGET_MS`, decoded as jackson decodes it, and with
 * `decryptionKey` (`null` for a response jackson would not decrypt) decrypt its encrypted assertion within the same
 * budget and hold the result to the byte bounds, then run jackson's signature check with `idpVerification` (`null`
 * when no connection is configured). Never rejects: every way it can end is an outcome.
 */
export const probeSamlResponseParse = (
  samlResponseBase64: string,
  decryptionKey: string | null,
  idpVerification: SamlIdpVerification | null
): Promise<SamlParseProbe> => {
  refillAllowance(performance.now());
  if (pool.queue.length >= SAML_PARSE_QUEUE_LIMIT || pool.allowanceMs <= 0) {
    return Promise.resolve({ outcome: "busy" });
  }

  return new Promise<SamlParseProbe>((resolve) => {
    pool.queue.push({
      id: pool.nextId++,
      xml: Buffer.from(samlResponseBase64, "base64").toString(),
      decryptionKey,
      idpVerification,
      resolve,
    });
    pump();
  });
};
