import { describe, expect, test } from "vitest";
import { SURVEY_GENERATION_SNAPSHOT_THROTTLE_MS, shouldEmitSnapshot } from "./events";

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
