import { describe, expect, test, vi } from "vitest";
import { ConcurrencyLimiter, releaseWhenBodySettles } from "./concurrency-limiter";

/** Takes a slot or fails the test, for setups that need one held. */
const take = (limiter: ConcurrencyLimiter, key?: string) => {
  const slot = limiter.tryAcquire(key);
  if (!slot.ok) throw new Error(`expected a slot, got ${slot.reason}`);
  return slot.release;
};

describe("ConcurrencyLimiter", () => {
  test("hands out slots up to the limit, then refuses for capacity", () => {
    const limiter = new ConcurrencyLimiter(2);

    take(limiter);
    take(limiter);

    expect(limiter.tryAcquire()).toEqual({ ok: false, reason: "capacity" });
    expect(limiter.inFlight).toBe(2);
  });

  test("a released slot can be taken again", () => {
    const limiter = new ConcurrencyLimiter(1);

    take(limiter)();

    expect(limiter.inFlight).toBe(0);
    expect(limiter.tryAcquire().ok).toBe(true);
  });

  test("releasing twice frees one slot, not two", () => {
    // Every exit path may release, so a double release must not hand out a slot that is still held.
    const limiter = new ConcurrencyLimiter(1);
    const first = take(limiter);
    first();
    const second = take(limiter);

    first();

    expect(limiter.inFlight).toBe(1);
    expect(limiter.tryAcquire().ok).toBe(false);
    second();
  });

  test("caps one key at maxPerKey while other keys still get slots", () => {
    const limiter = new ConcurrencyLimiter(3, { maxPerKey: 1 });

    const alice = take(limiter, "alice");

    expect(limiter.tryAcquire("alice")).toEqual({ ok: false, reason: "per_key" });
    expect(limiter.tryAcquire("bob").ok).toBe(true);
    alice();
    expect(limiter.inFlightFor("alice")).toBe(0);
    expect(limiter.tryAcquire("alice").ok).toBe(true);
  });

  test("a refusal for one key takes no slot", () => {
    const limiter = new ConcurrencyLimiter(2, { maxPerKey: 1 });
    take(limiter, "alice");

    limiter.tryAcquire("alice");

    expect(limiter.inFlight).toBe(1);
  });

  test("without a key only the process-wide limit applies", () => {
    const limiter = new ConcurrencyLimiter(2, { maxPerKey: 1 });

    take(limiter);
    take(limiter);

    expect(limiter.tryAcquire()).toEqual({ ok: false, reason: "capacity" });
  });

  test.each([0, -1, 2.5, Number.NaN])("refuses a limit of %s", (maxInFlight) => {
    expect(() => new ConcurrencyLimiter(maxInFlight)).toThrow(/maxInFlight must be a positive integer/);
  });

  test.each([0, -1, 2.5])("refuses a per-key limit of %s", (maxPerKey) => {
    expect(() => new ConcurrencyLimiter(2, { maxPerKey })).toThrow(/maxPerKey must be a positive integer/);
  });
});

describe("releaseWhenBodySettles", () => {
  const streamOf = (...chunks: string[]) =>
    new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(new TextEncoder().encode(chunk));
        controller.close();
      },
    });

  test("releases at once for a response without a body", () => {
    let released = 0;

    releaseWhenBodySettles(new Response(null, { status: 204 }), () => released++);

    expect(released).toBe(1);
  });

  test("holds the slot until the body has been read to the end", async () => {
    let released = 0;
    const response = releaseWhenBodySettles(
      new Response(streamOf("a", "b"), { status: 200, headers: { "X-Request-Id": "req_1" } }),
      () => released++
    );

    expect(released).toBe(0);
    expect(response.headers.get("X-Request-Id")).toBe("req_1");
    await expect(response.text()).resolves.toBe("ab");
    expect(released).toBe(1);
  });

  test("releases when the client cancels the body, and cancels the source", async () => {
    let released = 0;
    let sourceCancelled = false;
    const source = new ReadableStream<Uint8Array>({
      pull() {
        // Never produces: the work behind it is still running when the client goes away.
      },
      cancel() {
        sourceCancelled = true;
      },
    });

    await releaseWhenBodySettles(new Response(source), () => released++).body?.cancel();

    expect(released).toBe(1);
    expect(sourceCancelled).toBe(true);
  });

  test("a client cancelling a body whose source already failed does not reject", async () => {
    let released = 0;
    const failing = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.error(new Error("producer failed"));
      },
    });

    await expect(
      releaseWhenBodySettles(new Response(failing), () => released++).body?.cancel()
    ).resolves.toBeUndefined();
    expect(released).toBe(1);
  });

  test("releases when the body fails", async () => {
    let released = 0;
    const failing = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.error(new Error("producer failed"));
      },
    });

    await expect(releaseWhenBodySettles(new Response(failing), () => released++).text()).rejects.toThrow(
      "producer failed"
    );
    expect(released).toBe(1);
  });

  describe("with the request's signal", () => {
    const pending = () => new Response(new ReadableStream<Uint8Array>({ pull() {} }));

    test("releases when the client leaves, though nothing reads or cancels the body", () => {
      const client = new AbortController();
      const release = vi.fn();

      releaseWhenBodySettles(pending(), release, client.signal);
      expect(release).not.toHaveBeenCalled();
      client.abort();

      expect(release).toHaveBeenCalledTimes(1);
    });

    test("releases at once when the client already left", () => {
      const release = vi.fn();

      releaseWhenBodySettles(pending(), release, AbortSignal.abort());

      expect(release).toHaveBeenCalledTimes(1);
    });

    test("stops listening once the body settled, so a later abort calls nothing", async () => {
      const client = new AbortController();
      const release = vi.fn();

      await releaseWhenBodySettles(new Response("done"), release, client.signal).text();
      client.abort();

      expect(release).toHaveBeenCalledTimes(1);
    });

    test("does not listen at all for a response without a body", () => {
      const client = new AbortController();
      const release = vi.fn();
      const listen = vi.spyOn(client.signal, "addEventListener");

      releaseWhenBodySettles(new Response(null), release, client.signal);

      expect(release).toHaveBeenCalledTimes(1);
      expect(listen).not.toHaveBeenCalled();
    });

    test("throws for a locked body before taking the slot over, leaving it to the caller", () => {
      const client = new AbortController();
      const release = vi.fn();
      const locked = pending();
      locked.body?.getReader();

      expect(() => releaseWhenBodySettles(locked, release, client.signal)).toThrow();
      client.abort();

      expect(release).not.toHaveBeenCalled();
    });
  });
});
