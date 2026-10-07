import { afterEach, describe, expect, test, vi } from "vitest";
import { logger } from "@formbricks/logger";
import { NDJSON_CONTENT_TYPE, createNdjsonResponse, encodeNdjsonLine } from "./ndjson-stream";

vi.mock("@formbricks/logger", () => ({ logger: { error: vi.fn() } }));

const decoder = new TextDecoder();
const decode = (event: unknown) => decoder.decode(encodeNdjsonLine(event));

describe("encodeNdjsonLine", () => {
  test("appends exactly one trailing newline", () => {
    const encoded = decode({ type: "start", requestId: "req_1" });

    expect(encoded.endsWith("\n")).toBe(true);
    expect(encoded.slice(0, -1)).not.toContain("\n");
  });

  test("round-trips every event variant through a newline split", () => {
    const events = [
      { type: "start", requestId: "req_1" },
      { type: "partial", seq: 3, draft: { name: "Onboarding" } },
      {
        type: "done",
        language: "en",
        payload: { name: "Onboarding" },
        validation: { valid: true, invalid_params: [], languages: [] },
      },
      { type: "error", code: "ai_quota_exceeded", detail: "Rate-limited.", retryAfter: 30 },
    ];

    const body = events.map((event) => decode(event)).join("");
    const parsed = body
      .split("\n")
      .filter((line) => line.length > 0)
      .map((line) => JSON.parse(line));

    expect(parsed).toEqual(events);
  });

  test("model text containing newlines cannot break framing", () => {
    // The single assumption NDJSON rests on. JSON.stringify escapes these inside strings, so a
    // headline the model wrote with a line break stays one frame instead of splitting into two.
    const draft = { name: "Line one\nLine two\r\nLine three Line four" };

    const encoded = decode({ type: "partial", seq: 1, draft });
    const lines = encoded.split("\n").filter((line) => line.length > 0);

    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0])).toEqual({ type: "partial", seq: 1, draft });
  });
});

type TEvent = { type: string; n?: number };

const readLines = async (response: Response) =>
  (await response.text())
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as TEvent);

describe("createNdjsonResponse", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test("streams what produce writes, then closes, with headers that stop buffering", async () => {
    const onSettled = vi.fn();
    const response = createNdjsonResponse<TEvent>({
      produce: async (emit) => {
        emit({ type: "start" });
        emit({ type: "done" });
      },
      onError: () => null,
      onCancel: vi.fn(),
      onSettled,
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe(NDJSON_CONTENT_TYPE);
    expect(response.headers.get("Cache-Control")).toContain("no-transform");
    expect(response.headers.get("X-Accel-Buffering")).toBe("no");
    await expect(readLines(response)).resolves.toEqual([{ type: "start" }, { type: "done" }]);
    expect(onSettled).toHaveBeenCalledTimes(1);
  });

  test("closes cleanly when the settle hook throws, and logs where it failed but not what it said", async () => {
    const response = createNdjsonResponse<TEvent>({
      produce: async (emit) => {
        emit({ type: "done" });
      },
      onError: () => null,
      onCancel: vi.fn(),
      onSettled: () => {
        throw new TypeError("settle hook broke on secret-from-the-stream");
      },
    });

    await expect(readLines(response)).resolves.toEqual([{ type: "done" }]);
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        errName: "TypeError",
        errStack: expect.stringMatching(/^ +at \S.*(?:\n +at \S.*)*$/),
      }),
      "NDJSON stream settle hook failed"
    );
    expect(JSON.stringify(vi.mocked(logger.error).mock.calls)).not.toContain("secret-from-the-stream");
  });

  test("still delivers what was written and closes cleanly when the error mapper throws", async () => {
    const onSettled = vi.fn();
    const response = createNdjsonResponse<TEvent>({
      produce: async (emit) => {
        emit({ type: "start" });
        throw new Error("produce failed");
      },
      onError: () => {
        throw new TypeError("mapper broke on secret-from-the-stream");
      },
      onCancel: vi.fn(),
      onSettled,
    });

    await expect(readLines(response)).resolves.toEqual([{ type: "start" }]);
    expect(onSettled).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ errName: "TypeError" }),
      "NDJSON stream error mapper failed"
    );
    expect(JSON.stringify(vi.mocked(logger.error).mock.calls)).not.toContain("secret-from-the-stream");
  });

  test("turns an escaped failure into a final event and still closes cleanly", async () => {
    const response = createNdjsonResponse<TEvent>({
      produce: async (emit) => {
        emit({ type: "start" });
        throw new Error("provider failed");
      },
      onError: () => ({ type: "error" }),
      onCancel: vi.fn(),
    });

    await expect(readLines(response)).resolves.toEqual([{ type: "start" }, { type: "error" }]);
  });

  test("ends quietly when onError returns null", async () => {
    const response = createNdjsonResponse<TEvent>({
      produce: async () => {
        throw new Error("aborted");
      },
      onError: () => null,
      onCancel: vi.fn(),
    });

    await expect(readLines(response)).resolves.toEqual([]);
  });

  test("on cancel: calls onCancel, writes nothing more, and settles once produce ends", async () => {
    let finish: (() => void) | undefined;
    let emitAfterCancel: (() => void) | undefined;
    const onCancel = vi.fn();
    const onSettled = vi.fn();
    const response = createNdjsonResponse<TEvent>({
      produce: (emit) =>
        new Promise<void>((resolve) => {
          emit({ type: "start" });
          emitAfterCancel = () => emit({ type: "late" });
          finish = resolve;
        }),
      onError: () => null,
      onCancel,
      onSettled,
    });

    await response.body?.cancel();
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSettled).not.toHaveBeenCalled();

    // Would throw "Invalid state: Controller is already closed" if the guard were missing.
    expect(() => emitAfterCancel?.()).not.toThrow();
    finish?.();
    await vi.waitFor(() => expect(onSettled).toHaveBeenCalledTimes(1));
  });

  test("sends a heartbeat after the configured silence, and again after each further silence", async () => {
    vi.useFakeTimers();
    let finish: (() => void) | undefined;
    const response = createNdjsonResponse<TEvent>({
      produce: (emit) =>
        new Promise<void>((resolve) => {
          emit({ type: "start" });
          finish = () => {
            emit({ type: "done" });
            resolve();
          };
        }),
      onError: () => null,
      onCancel: vi.fn(),
      heartbeat: { intervalMs: 10_000, event: () => ({ type: "progress" }) },
    });

    await vi.advanceTimersByTimeAsync(9_999);
    await vi.advanceTimersByTimeAsync(1);
    await vi.advanceTimersByTimeAsync(10_000);
    finish?.();
    await vi.advanceTimersByTimeAsync(60_000);

    await expect(readLines(response)).resolves.toEqual([
      { type: "start" },
      { type: "progress" },
      { type: "progress" },
      { type: "done" },
    ]);
  });

  test("a write resets the heartbeat clock", async () => {
    vi.useFakeTimers();
    let emitNow: ((event: TEvent) => void) | undefined;
    let finish: (() => void) | undefined;
    const response = createNdjsonResponse<TEvent>({
      produce: (emit) =>
        new Promise<void>((resolve) => {
          emitNow = emit;
          finish = resolve;
        }),
      onError: () => null,
      onCancel: vi.fn(),
      heartbeat: { intervalMs: 10_000, event: () => ({ type: "progress" }) },
    });

    await vi.advanceTimersByTimeAsync(6_000);
    emitNow?.({ type: "partial" });
    await vi.advanceTimersByTimeAsync(6_000);
    finish?.();
    await vi.advanceTimersByTimeAsync(0);

    // 12 s in, but only 6 s since the last write: no heartbeat yet.
    await expect(readLines(response)).resolves.toEqual([{ type: "partial" }]);
  });

  test.each([0, -1, Number.NaN])("refuses a heartbeat interval of %s", (intervalMs) => {
    expect(() =>
      createNdjsonResponse<TEvent>({
        produce: async () => undefined,
        onError: () => null,
        onCancel: vi.fn(),
        heartbeat: { intervalMs, event: () => ({ type: "progress" }) },
      })
    ).toThrow(/intervalMs must be positive/);
  });
});
