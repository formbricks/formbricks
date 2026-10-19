import "server-only";
import { Worker } from "node:worker_threads";
import { logger } from "@formbricks/logger";

/**
 * Longest a SAMLResponse may take to parse before jackson sees it (ENG-3973).
 *
 * `checkSamlResponseBounds` is the cheap first gate, but it models xmldom from the outside, and every shape it
 * misreads is a way back to a slow parse. This gate does not model anything: a worker thread parses the response
 * the way `@boxyhq/saml20` does and is terminated if it runs past the budget, so whatever the shape, an
 * anonymous response costs this thread nothing and the worker at most the budget. A real response parses in
 * ~5-25 ms (1,000 verbose Okta groups ~11 ms), so 100 ms leaves room on a busy host.
 */
export const SAML_PARSE_TIME_BUDGET_MS = 100;

/**
 * Jobs that may wait for the worker. One parse runs at a time, so a flood that fills the queue is refused at
 * once rather than queued behind itself; the per-IP limit in front of this keeps a single caller from doing so.
 */
export const SAML_PARSE_QUEUE_LIMIT = 16;

/**
 * Heap for the worker. A response within the markup budget builds a DOM of a few MB; a parse that tries to
 * grow past this ends the worker, not the server.
 */
const WORKER_RESOURCE_LIMITS = { maxOldGenerationSizeMb: 64, maxYoungGenerationSizeMb: 16 };

/** What the worker read from the response: identifiers only, for logging. All of it is unauthenticated. */
export interface SamlResponseClaims {
  issuer?: string;
  id?: string;
  inResponseTo?: string;
}

export type SamlParseProbe =
  | { outcome: "parsed"; ms: number; claims: SamlResponseClaims }
  /** It ran past the budget; the worker was terminated. */
  | { outcome: "too_slow" }
  /** The queue was full; nothing was parsed. */
  | { outcome: "busy" }
  /** The worker died (out of memory, or a crash); nothing is known about the response. */
  | { outcome: "failed" };

interface Job {
  id: number;
  xml: string;
  resolve: (probe: SamlParseProbe) => void;
}

interface Pool {
  worker: Worker | null;
  ready: Promise<Worker> | null;
  /** The job holding the worker. Claimed before the worker is ready, so only one job is ever dispatched. */
  running: (Job & { startedAt?: number; timer?: NodeJS.Timeout }) | null;
  queue: Job[];
  nextId: number;
}

/** How long a new worker may take to load xmldom and report ready before it is treated as failed. */
const WORKER_STARTUP_TIMEOUT_MS = 5_000;

const pool: Pool = { worker: null, ready: null, running: null, queue: [], nextId: 0 };

const settleRunning = (probe: SamlParseProbe) => {
  const job = pool.running;
  if (!job) return;
  if (job.timer) clearTimeout(job.timer);
  pool.running = null;
  job.resolve(probe);
  pump();
};

const discardWorker = (worker: Worker) => {
  if (pool.worker !== worker) return;
  pool.worker = null;
  pool.ready = null;
  void worker.terminate();
};

const startWorker = (): Promise<Worker> => {
  const worker = new Worker(new URL("./saml-parse-worker.ts", import.meta.url), {
    resourceLimits: WORKER_RESOURCE_LIMITS,
  });
  // A background thread must never keep the server process alive on its own.
  worker.unref();
  pool.worker = worker;

  return new Promise<Worker>((resolve, reject) => {
    const onFailure = (error: Error | number) => {
      clearTimeout(startup);
      if (pool.worker !== worker) return;
      pool.worker = null;
      pool.ready = null;
      logger.warn(
        { error: error instanceof Error ? error.message : `exit ${error}` },
        "SAML parse worker stopped"
      );
      reject(error instanceof Error ? error : new Error(`SAML parse worker exited with ${error}`));
      void worker.terminate();
      settleRunning({ outcome: "failed" });
    };
    const startup = setTimeout(
      () => onFailure(new Error("SAML parse worker did not start")),
      WORKER_STARTUP_TIMEOUT_MS
    );

    worker.on("message", (message: { ready?: true; id?: number; claims?: SamlResponseClaims }) => {
      if (message.ready) {
        clearTimeout(startup);
        resolve(worker);
        return;
      }
      const job = pool.running;
      if (job?.startedAt !== undefined && message.id === job.id) {
        settleRunning({
          outcome: "parsed",
          ms: performance.now() - job.startedAt,
          claims: message.claims ?? {},
        });
      }
    });
    worker.on("error", onFailure);
    worker.on("exit", onFailure);
  });
};

function pump(): void {
  if (pool.running) return;
  const job = pool.queue.shift();
  if (!job) return;
  pool.running = job;

  pool.ready ??= startWorker();
  pool.ready.then(
    (worker) => {
      if (pool.running !== job) return;
      pool.running = {
        ...job,
        startedAt: performance.now(),
        timer: setTimeout(() => {
          // Terminating stops xmldom mid-parse: it is plain JavaScript, which V8 interrupts at once.
          discardWorker(worker);
          settleRunning({ outcome: "too_slow" });
        }, SAML_PARSE_TIME_BUDGET_MS),
      };
      worker.postMessage({ id: job.id, xml: job.xml });
    },
    () => {
      if (pool.running === job) settleRunning({ outcome: "failed" });
    }
  );
}

/**
 * Parse `samlResponseBase64` in the worker under `SAML_PARSE_TIME_BUDGET_MS`, decoded as jackson decodes it.
 * Never rejects: every way it can end is an outcome.
 */
export const probeSamlResponseParse = (samlResponseBase64: string): Promise<SamlParseProbe> => {
  if (pool.queue.length >= SAML_PARSE_QUEUE_LIMIT) return Promise.resolve({ outcome: "busy" });

  return new Promise<SamlParseProbe>((resolve) => {
    pool.queue.push({
      id: pool.nextId++,
      xml: Buffer.from(samlResponseBase64, "base64").toString(),
      resolve,
    });
    pump();
  });
};
