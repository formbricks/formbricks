import { afterEach, describe, expect, test, vi } from "vitest";
import { RequestDeadlineExceededError, createRequestAbort } from "./request-abort";

const requestWith = (signal: AbortSignal) =>
  new Request("http://localhost/api/internal/surveys/import/stream", { method: "POST", signal });

describe("createRequestAbort", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test("aborts when the client disconnects", () => {
    const client = new AbortController();
    const abort = createRequestAbort(requestWith(client.signal));

    client.abort();

    expect(abort.signal.aborted).toBe(true);
    expect(abort.deadlineExceeded()).toBe(false);
  });

  test("starts aborted when the client already left", () => {
    // An abort is never replayed to a listener added afterwards.
    const client = new AbortController();
    client.abort();

    expect(createRequestAbort(requestWith(client.signal)).signal.aborted).toBe(true);
  });

  test("abort() stops the work without the client leaving", () => {
    const abort = createRequestAbort(requestWith(new AbortController().signal));

    abort.abort();

    expect(abort.signal.aborted).toBe(true);
  });

  test("aborts at the deadline with a reason that says so", () => {
    vi.useFakeTimers();
    const abort = createRequestAbort(requestWith(new AbortController().signal), { deadlineMs: 120_000 });

    vi.advanceTimersByTime(119_999);
    expect(abort.signal.aborted).toBe(false);
    vi.advanceTimersByTime(1);

    expect(abort.signal.aborted).toBe(true);
    expect(abort.deadlineExceeded()).toBe(true);
    expect(abort.signal.reason).toBeInstanceOf(RequestDeadlineExceededError);
  });

  test("a client that leaves first is not reported as a deadline", () => {
    vi.useFakeTimers();
    const client = new AbortController();
    const abort = createRequestAbort(requestWith(client.signal), { deadlineMs: 1_000 });

    client.abort();
    vi.advanceTimersByTime(5_000);

    expect(abort.deadlineExceeded()).toBe(false);
  });

  test("dispose detaches from the request and clears the deadline", () => {
    vi.useFakeTimers();
    const client = new AbortController();
    const abort = createRequestAbort(requestWith(client.signal), { deadlineMs: 1_000 });

    abort.dispose();
    client.abort();
    vi.advanceTimersByTime(5_000);

    expect(abort.signal.aborted).toBe(false);
  });

  test.each([0, -1, 1.5])("refuses a deadline of %s", (deadlineMs) => {
    expect(() => createRequestAbort(requestWith(new AbortController().signal), { deadlineMs })).toThrow(
      /deadlineMs must be a positive integer/
    );
  });
});
