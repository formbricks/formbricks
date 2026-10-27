import { beforeEach, describe, expect, test, vi } from "vitest";
import { getAITimeoutMs } from "./timeout";

const aiTimeoutEnv = vi.hoisted(() => ({ multiplier: 1 }));

vi.mock("@/lib/env", () => ({
  env: {
    get AI_TIMEOUT_MULTIPLIER() {
      return aiTimeoutEnv.multiplier;
    },
  },
}));

describe("getAITimeoutMs", () => {
  beforeEach(() => {
    aiTimeoutEnv.multiplier = 1;
  });

  test.each([30_000, 45_000, 120_000])("preserves the default %i ms budget", (baseMs) => {
    expect(getAITimeoutMs(baseMs)).toBe(baseMs);
  });

  test.each([
    [1.5, 45_000, 67_500],
    [3, 30_000, 90_000],
    [3, 45_000, 135_000],
    [3, 120_000, 360_000],
    [10, 45_000, 450_000],
    [10, 120_000, 1_200_000],
    [1.00001, 45_000, 45_001],
  ])("scales %i × %i to %i ms", (multiplier, baseMs, expected) => {
    aiTimeoutEnv.multiplier = multiplier;
    expect(getAITimeoutMs(baseMs)).toBe(expected);
  });
});
