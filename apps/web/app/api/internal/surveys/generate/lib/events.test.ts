import { describe, expect, test } from "vitest";
import {
  SURVEY_GENERATION_SNAPSHOT_THROTTLE_MS,
  type TSurveyGenerationStreamEvent,
  encodeStreamEvent,
  shouldEmitSnapshot,
} from "./events";

const decoder = new TextDecoder();
const decode = (event: TSurveyGenerationStreamEvent) => decoder.decode(encodeStreamEvent(event));

describe("encodeStreamEvent", () => {
  test("appends exactly one trailing newline", () => {
    const encoded = decode({ type: "start", requestId: "req_1" });

    expect(encoded.endsWith("\n")).toBe(true);
    expect(encoded.slice(0, -1)).not.toContain("\n");
  });

  test("round-trips every event variant through a newline split", () => {
    const events: TSurveyGenerationStreamEvent[] = [
      { type: "start", requestId: "req_1" },
      { type: "partial", seq: 3, draft: { name: "Onboarding" } },
      {
        type: "done",
        language: "en",
        payload: { name: "Onboarding" } as never,
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

describe("shouldEmitSnapshot", () => {
  const serialized = '{"name":"Onboarding"}';

  test("emits the first snapshot immediately", () => {
    expect(shouldEmitSnapshot({ now: 1_000, lastEmittedAt: null, serialized, lastSerialized: null })).toBe(
      true
    );
  });

  test("suppresses a snapshot inside the throttle window", () => {
    expect(
      shouldEmitSnapshot({
        now: 1_010,
        lastEmittedAt: 1_000,
        serialized,
        lastSerialized: '{"name":"Onboard"}',
      })
    ).toBe(false);
  });

  test("emits once the throttle window has elapsed", () => {
    expect(
      shouldEmitSnapshot({
        now: 1_000 + SURVEY_GENERATION_SNAPSHOT_THROTTLE_MS,
        lastEmittedAt: 1_000,
        serialized,
        lastSerialized: '{"name":"Onboard"}',
      })
    ).toBe(true);
  });

  test("suppresses a byte-identical snapshot however long the gap", () => {
    expect(
      shouldEmitSnapshot({ now: 99_000, lastEmittedAt: 1_000, serialized, lastSerialized: serialized })
    ).toBe(false);
  });
});
