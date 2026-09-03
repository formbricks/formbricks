import { describe, expect, test } from "vitest";
import { formatElapsed, getCycledIndex, resolveStatusMessage } from "./status-line";

describe("formatElapsed", () => {
  test.each([
    [0, "0s"],
    [6_400, "6s"],
    [59_900, "59s"],
    [60_000, "1m 0s"],
    [64_000, "1m 4s"],
    [3_600_000, "60m 0s"],
  ])("renders %ims as %s", (elapsedMs, expected) => {
    expect(formatElapsed(elapsedMs)).toBe(expected);
  });

  test("clamps a negative elapsed to zero rather than rendering a negative counter", () => {
    expect(formatElapsed(-1_000)).toBe("0s");
  });
});

describe("getCycledIndex", () => {
  const messageCount = 3;
  const cadenceMs = 2_500;

  test("advances one step per cadence", () => {
    expect(getCycledIndex({ elapsedMs: 0, cadenceMs, messageCount })).toBe(0);
    expect(getCycledIndex({ elapsedMs: 2_499, cadenceMs, messageCount })).toBe(0);
    expect(getCycledIndex({ elapsedMs: 2_500, cadenceMs, messageCount })).toBe(1);
    expect(getCycledIndex({ elapsedMs: 5_000, cadenceMs, messageCount })).toBe(2);
  });

  test("holds on the last message instead of wrapping", () => {
    // Wrapping would tell the user the work restarted.
    expect(getCycledIndex({ elapsedMs: 7_500, cadenceMs, messageCount })).toBe(2);
    expect(getCycledIndex({ elapsedMs: 600_000, cadenceMs, messageCount })).toBe(2);
  });

  test("survives an empty message list", () => {
    expect(getCycledIndex({ elapsedMs: 5_000, cadenceMs, messageCount: 0 })).toBe(0);
  });
});

describe("resolveStatusMessage", () => {
  const messages = ["Reading your prompt…", "Naming your survey…", "Writing questions…"];

  test("a supplied activeIndex wins over the clock", () => {
    expect(resolveStatusMessage({ messages, activeIndex: 2, elapsedMs: 0, cadenceMs: 2_500 })).toBe(
      "Writing questions…"
    );
  });

  test("falls back to the timed cycle when no index is supplied", () => {
    expect(resolveStatusMessage({ messages, elapsedMs: 2_600, cadenceMs: 2_500 })).toBe(
      "Naming your survey…"
    );
  });

  test("clamps an out-of-range activeIndex to a real message", () => {
    expect(resolveStatusMessage({ messages, activeIndex: 99, elapsedMs: 0, cadenceMs: 2_500 })).toBe(
      "Writing questions…"
    );
    expect(resolveStatusMessage({ messages, activeIndex: -3, elapsedMs: 0, cadenceMs: 2_500 })).toBe(
      "Reading your prompt…"
    );
  });

  test("returns an empty string rather than throwing on no messages", () => {
    expect(resolveStatusMessage({ messages: [], elapsedMs: 1_000, cadenceMs: 2_500 })).toBe("");
  });
});
