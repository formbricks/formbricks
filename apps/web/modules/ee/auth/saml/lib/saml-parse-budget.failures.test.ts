import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// The failure paths of the parse pool, driven through a fake worker so each one can be staged exactly: a worker that
// cannot be created, never starts, dies mid-job, runs out of heap, or answers behind a stalled main thread. The real
// worker is exercised in saml-parse-budget.test.ts.

class FakePort extends EventEmitter {
  peer!: FakePort;
  /** Messages delivered to this port but not yet read, so a test decides when the listener sees them. */
  inbox: unknown[] = [];
  postMessage(message: unknown) {
    this.peer.inbox.push(message);
  }
  close() {}
  unref() {}
  /** Deliver everything waiting to the port's listener. */
  flush() {
    for (const message of this.inbox.splice(0)) this.emit("message", message);
  }
}

class FakeWorker extends EventEmitter {
  port: FakePort;
  terminate = vi.fn(async () => {
    this.emit("exit", 1);
    return 1;
  });
  constructor(_url: URL, options: { workerData: { port: FakePort } }) {
    super();
    this.port = options.workerData.port;
    if (state.throwOnCreate) throw Object.assign(new Error("thread"), { code: "ERR_WORKER_INIT_FAILED" });
    state.workers.push(this);
  }
  unref() {}
  /** The worker side: report ready, or answer a job. */
  ready() {
    this.port.postMessage({ ready: true });
  }
  answer(ms = 5) {
    const job = this.port.inbox.shift() as { id: number };
    this.port.postMessage({ id: job.id, ms, claims: { issuer: "https://idp.example.com" } });
  }
}

const state: { workers: FakeWorker[]; throwOnCreate: boolean } = { workers: [], throwOnCreate: false };

vi.mock("node:worker_threads", () => ({
  Worker: FakeWorker,
  MessageChannel: class {
    port1 = new FakePort();
    port2 = new FakePort();
    constructor() {
      this.port1.peer = this.port2;
      this.port2.peer = this.port1;
    }
  },
  receiveMessageOnPort: (port: FakePort) => {
    const message = port.inbox.shift();
    return message === undefined ? undefined : { message };
  },
}));

vi.mock("@formbricks/logger", () => ({ logger: { warn: vi.fn(), error: vi.fn() } }));

/** The main-thread end of the newest worker's channel. */
const mainPort = (worker: FakeWorker) => worker.port.peer;

/** Let the pool's promise callbacks run. */
const settle = () => vi.advanceTimersByTimeAsync(0);

const load = async () => {
  vi.resetModules();
  delete globalThis.samlParsePool;
  return import("./saml-parse-budget");
};

describe("probeSamlResponseParse failure paths", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    state.workers = [];
    state.throwOnCreate = false;
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  test("answers failed, and keeps serving, when the thread cannot be created", async () => {
    const { probeSamlResponseParse } = await load();
    state.throwOnCreate = true;

    await expect(probeSamlResponseParse("PHIvPg==")).resolves.toEqual({ outcome: "failed" });

    state.throwOnCreate = false;
    const next = probeSamlResponseParse("PHIvPg==");
    await settle();
    state.workers[0].ready();
    mainPort(state.workers[0]).flush();
    await settle();
    state.workers[0].answer();
    mainPort(state.workers[0]).flush();
    await expect(next).resolves.toMatchObject({ outcome: "parsed" });
  });

  test("fails everything waiting when the worker never becomes ready", async () => {
    const { probeSamlResponseParse } = await load();
    const probes = [probeSamlResponseParse("PHIvPg=="), probeSamlResponseParse("PHIvPg==")];

    await vi.advanceTimersByTimeAsync(5_000);

    await expect(Promise.all(probes)).resolves.toEqual([{ outcome: "failed" }, { outcome: "failed" }]);
    expect(state.workers[0].terminate).toHaveBeenCalled();
  });

  test("answers failed when the worker dies mid-job, and the next job gets a fresh worker", async () => {
    const { probeSamlResponseParse } = await load();
    const first = probeSamlResponseParse("PHIvPg==");
    await settle();
    state.workers[0].ready();
    mainPort(state.workers[0]).flush();
    await settle();

    state.workers[0].emit("exit", 1);
    await expect(first).resolves.toEqual({ outcome: "failed" });

    const second = probeSamlResponseParse("PHIvPg==");
    await settle();
    expect(state.workers).toHaveLength(2);
    state.workers[1].ready();
    mainPort(state.workers[1]).flush();
    await settle();
    state.workers[1].answer();
    mainPort(state.workers[1]).flush();
    await expect(second).resolves.toMatchObject({ outcome: "parsed" });
  });

  test("counts running out of heap mid-job as the response's cost, not a server failure", async () => {
    const { probeSamlResponseParse } = await load();
    const probe = probeSamlResponseParse("PHIvPg==");
    await settle();
    state.workers[0].ready();
    mainPort(state.workers[0]).flush();
    await settle();

    state.workers[0].emit("error", Object.assign(new Error("heap"), { code: "ERR_WORKER_OUT_OF_MEMORY" }));

    await expect(probe).resolves.toEqual({ outcome: "too_costly", reason: "memory" });
  });

  test("takes an answer waiting behind a stalled main thread instead of blaming the response", async () => {
    const { probeSamlResponseParse } = await load();
    const probe = probeSamlResponseParse("PHIvPg==");
    await settle();
    state.workers[0].ready();
    mainPort(state.workers[0]).flush();
    await settle();

    // The worker answered in 5 ms, but the main thread did not get to it before the budget timer fired.
    state.workers[0].answer(5);
    await vi.advanceTimersByTimeAsync(100);

    await expect(probe).resolves.toMatchObject({ outcome: "parsed", ms: 5 });
    expect(state.workers[0].terminate).not.toHaveBeenCalled();
  });

  test("judges the time the worker measured, not the time the answer took to arrive", async () => {
    const { probeSamlResponseParse } = await load();
    const probe = probeSamlResponseParse("PHIvPg==");
    await settle();
    state.workers[0].ready();
    mainPort(state.workers[0]).flush();
    await settle();

    state.workers[0].answer(150);
    mainPort(state.workers[0]).flush();

    await expect(probe).resolves.toEqual({ outcome: "too_costly", reason: "time" });
  });

  test("terminates the worker and answers too_costly when nothing comes back within the budget", async () => {
    const { probeSamlResponseParse } = await load();
    const probe = probeSamlResponseParse("PHIvPg==");
    await settle();
    state.workers[0].ready();
    mainPort(state.workers[0]).flush();
    await settle();

    await vi.advanceTimersByTimeAsync(100);

    await expect(probe).resolves.toEqual({ outcome: "too_costly", reason: "time" });
    expect(state.workers[0].terminate).toHaveBeenCalled();
  });

  test("answers busy once this process has spent its main-thread parse allowance, and recovers with time", async () => {
    const { probeSamlResponseParse, SAML_MAIN_THREAD_PARSE_ALLOWANCE_MS } = await load();
    const probe = probeSamlResponseParse("PHIvPg==");
    await settle();
    state.workers[0].ready();
    mainPort(state.workers[0]).flush();
    await settle();
    // One parse that jackson will repeat four times uses the whole allowance.
    state.workers[0].answer(SAML_MAIN_THREAD_PARSE_ALLOWANCE_MS / 4);
    mainPort(state.workers[0]).flush();
    await probe;

    await expect(probeSamlResponseParse("PHIvPg==")).resolves.toEqual({ outcome: "busy" });

    await vi.advanceTimersByTimeAsync(1_000);
    const later = probeSamlResponseParse("PHIvPg==");
    await settle();
    state.workers[0].answer();
    mainPort(state.workers[0]).flush();
    await expect(later).resolves.toMatchObject({ outcome: "parsed" });
  });

  test("answers busy for a job queued before the allowance ran out, once the job ahead of it spends it", async () => {
    const { probeSamlResponseParse, SAML_MAIN_THREAD_PARSE_ALLOWANCE_MS } = await load();
    // Both are accepted while the whole allowance is left.
    const first = probeSamlResponseParse("PHIvPg==");
    const second = probeSamlResponseParse("PHIvPg==");
    await settle();
    state.workers[0].ready();
    mainPort(state.workers[0]).flush();
    await settle();
    state.workers[0].answer(SAML_MAIN_THREAD_PARSE_ALLOWANCE_MS / 4);
    mainPort(state.workers[0]).flush();
    await expect(first).resolves.toMatchObject({ outcome: "parsed" });

    await settle();
    state.workers[0].answer(5);
    mainPort(state.workers[0]).flush();

    await expect(second).resolves.toEqual({ outcome: "busy" });

    // A response refused as busy costs nothing: 10 ms of refill is enough for the next one.
    await vi.advanceTimersByTimeAsync(10);
    const third = probeSamlResponseParse("PHIvPg==");
    await settle();
    state.workers[0].answer(1);
    mainPort(state.workers[0]).flush();
    await expect(third).resolves.toMatchObject({ outcome: "parsed" });
  });

  test("ignores a stale answer for a job it no longer runs", async () => {
    const { probeSamlResponseParse } = await load();
    const probe = probeSamlResponseParse("PHIvPg==");
    await settle();
    state.workers[0].ready();
    mainPort(state.workers[0]).flush();
    await settle();

    state.workers[0].port.postMessage({ id: 9_999, ms: 1, claims: {} });
    mainPort(state.workers[0]).flush();
    state.workers[0].answer(7);
    mainPort(state.workers[0]).flush();

    await expect(probe).resolves.toMatchObject({ outcome: "parsed", ms: 7 });
  });
});
