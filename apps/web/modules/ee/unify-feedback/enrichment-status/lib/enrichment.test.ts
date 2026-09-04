import { describe, expect, test } from "vitest";
import { totalFailedTerminalEnrichments, totalPendingEnrichments } from "./enrichment";
import type { TEnrichmentProgress } from "./enrichment";

const progress = (overrides: Partial<TEnrichmentProgress>): TEnrichmentProgress => ({
  kind: "sentiment",
  eligible: 0,
  done: 0,
  failedTerminal: 0,
  pending: 0,
  ...overrides,
});

describe("totalPendingEnrichments", () => {
  test("sums pending across enrichments", () => {
    expect(
      totalPendingEnrichments([progress({ pending: 5 }), progress({ kind: "emotions", pending: 3 })])
    ).toBe(8);
  });

  test("is zero for an empty list", () => {
    expect(totalPendingEnrichments([])).toBe(0);
  });
});

describe("totalFailedTerminalEnrichments", () => {
  test("sums failedTerminal across enrichments", () => {
    expect(
      totalFailedTerminalEnrichments([
        progress({ failedTerminal: 20 }),
        progress({ kind: "emotions", failedTerminal: 5 }),
      ])
    ).toBe(25);
  });

  test("is zero when nothing has failed permanently", () => {
    expect(totalFailedTerminalEnrichments([progress({ pending: 40 })])).toBe(0);
  });
});
