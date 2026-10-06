import { describe, expect, test } from "vitest";
import { ConcurrencyLimiter, releaseWhenBodySettles } from "./concurrency-limiter";

describe("ConcurrencyLimiter", () => {
  test("hands out slots up to the limit, then refuses", () => {
    const limiter = new ConcurrencyLimiter(2);

    expect(limiter.tryAcquire()).toBeTypeOf("function");
    expect(limiter.tryAcquire()).toBeTypeOf("function");
    expect(limiter.tryAcquire()).toBeNull();
    expect(limiter.inFlight).toBe(2);
  });

  test("a released slot can be taken again", () => {
    const limiter = new ConcurrencyLimiter(1);
    const release = limiter.tryAcquire();

    release?.();

    expect(limiter.inFlight).toBe(0);
    expect(limiter.tryAcquire()).toBeTypeOf("function");
  });

  test("releasing twice frees one slot, not two", () => {
    // Every exit path may release, so a double release must not hand out a slot that is still held.
    const limiter = new ConcurrencyLimiter(1);
    const first = limiter.tryAcquire();
    first?.();
    const second = limiter.tryAcquire();

    first?.();

    expect(limiter.inFlight).toBe(1);
    expect(limiter.tryAcquire()).toBeNull();
    second?.();
  });

  test.each([0, -1, 2.5, Number.NaN])("refuses a limit of %s", (maxInFlight) => {
    expect(() => new ConcurrencyLimiter(maxInFlight)).toThrow(/positive integer/);
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
});
