import "server-only";
import { MessageChannel, type MessagePort, Worker, receiveMessageOnPort } from "node:worker_threads";
import { logger } from "@formbricks/logger";

/**
 * Longest a SAMLResponse may take to parse before jackson sees it (ENG-3973).
 *
 * `checkSamlResponseBounds` is the cheap first gate, but it models xmldom from the outside, and a shape it misreads
 * is a way back to a slow parse. This gate does not model anything: a worker thread parses the response the way
 * `@boxyhq/saml20` does and is terminated if it runs past the budget. A response that passes is then parsed again by
 * jackson on this thread, a few times on the signature path, so what this bounds is the cost per parse: no response
 * slower than the budget reaches jackson, whatever its shape. The known shapes the byte bounds let through parse in
 * ~10-30 ms and a real response in ~5-25 ms (1,000 verbose Okta groups ~11 ms), so 100 ms only catches what the
 * bounds misread, with room for a busy host.
 */
export const SAML_PARSE_TIME_BUDGET_MS = 100;

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
 * parsed again by jackson on this thread, `JACKSON_PARSES_PER_RESPONSE` times on the signature path (issuer, decrypt,
 * xml2js, signature check), so each one is charged its worker-measured parse time times that. Past the allowance
 * the callback answers 503 rather than let many sources together keep the event loop busy with SAML. It is checked
 * when a response is queued and again when its parse finishes, so a burst can overdraw it by one response at most. A real
 * sign-in costs ~10-25 ms x 4, so this is a dozen or more sign-ins a second per process.
 */
export const SAML_MAIN_THREAD_PARSE_ALLOWANCE_MS = 300;
const JACKSON_PARSES_PER_RESPONSE = 4;

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
  refillAllowance(performance.now());
  if (pool.allowanceMs <= 0) {
    settleRunning({ outcome: "busy" });
    return true;
  }
  pool.allowanceMs -= result.ms * JACKSON_PARSES_PER_RESPONSE;
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
      handle.port.postMessage({ id: job.id, xml: job.xml });
    },
    () => {
      // Settled by the worker's failure handler already; this only guards a job left waiting on a failed start.
      if (pool.running === job) settleRunning({ outcome: "failed" });
    }
  );
}

/**
 * Parse `samlResponseBase64` in the worker under `SAML_PARSE_TIME_BUDGET_MS`, decoded as jackson decodes it. Never
 * rejects: every way it can end is an outcome.
 */
export const probeSamlResponseParse = (samlResponseBase64: string): Promise<SamlParseProbe> => {
  refillAllowance(performance.now());
  if (pool.queue.length >= SAML_PARSE_QUEUE_LIMIT || pool.allowanceMs <= 0) {
    return Promise.resolve({ outcome: "busy" });
  }

  return new Promise<SamlParseProbe>((resolve) => {
    pool.queue.push({
      id: pool.nextId++,
      xml: Buffer.from(samlResponseBase64, "base64").toString(),
      resolve,
    });
    pump();
  });
};
