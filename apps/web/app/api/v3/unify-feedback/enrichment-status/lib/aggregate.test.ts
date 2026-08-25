import { describe, expect, test } from "vitest";
import type { EnrichmentStatusResponse } from "@/modules/hub/types";
import { aggregateEnrichmentStatus } from "./aggregate";

const status = (
  overrides: Partial<
    Record<"translation" | "sentiment" | "emotions", Partial<EnrichmentStatusResponse["translation"]>>
  >
): EnrichmentStatusResponse => ({
  tenant_id: "frd-1",
  translation: { enabled: false, eligible: 0, done: 0, ...overrides.translation },
  sentiment: { enabled: false, eligible: 0, done: 0, ...overrides.sentiment },
  emotions: { enabled: false, eligible: 0, done: 0, ...overrides.emotions },
});

describe("aggregateEnrichmentStatus", () => {
  test("derives pending as eligible minus done", () => {
    const result = aggregateEnrichmentStatus([
      status({ translation: { enabled: true, eligible: 500, done: 480 } }),
    ]);

    expect(result).toEqual([
      { kind: "translation", eligible: 500, done: 480, failedTerminal: 0, pending: 20 },
    ]);
  });

  test("drops enrichments that are disabled everywhere", () => {
    const result = aggregateEnrichmentStatus([
      status({
        translation: { enabled: true, eligible: 500, done: 500 },
        sentiment: { enabled: true, eligible: 500, done: 200 },
      }),
    ]);

    expect(result.map((enrichment) => enrichment.kind)).toEqual(["translation", "sentiment"]);
  });

  test("returns nothing when no enrichment is enabled", () => {
    expect(aggregateEnrichmentStatus([status({})])).toEqual([]);
  });

  test("sums the counts across directories", () => {
    const result = aggregateEnrichmentStatus([
      status({ sentiment: { enabled: true, eligible: 300, done: 100 } }),
      status({ sentiment: { enabled: true, eligible: 200, done: 150 } }),
    ]);

    expect(result).toEqual([
      { kind: "sentiment", eligible: 500, done: 250, failedTerminal: 0, pending: 250 },
    ]);
  });

  test("ignores directories where the enrichment is switched off", () => {
    // The disabled directory reports zeros; counting it would only inflate the denominator with
    // records that can never be enriched.
    const result = aggregateEnrichmentStatus([
      status({ emotions: { enabled: true, eligible: 400, done: 100 } }),
      status({ emotions: { enabled: false, eligible: 0, done: 0 } }),
    ]);

    expect(result).toEqual([{ kind: "emotions", eligible: 400, done: 100, failedTerminal: 0, pending: 300 }]);
  });

  test("keeps an enrichment enabled on only one of several directories", () => {
    const result = aggregateEnrichmentStatus([
      status({ translation: { enabled: false, eligible: 0, done: 0 } }),
      status({ translation: { enabled: true, eligible: 120, done: 120 } }),
    ]);

    expect(result).toEqual([
      { kind: "translation", eligible: 120, done: 120, failedTerminal: 0, pending: 0 },
    ]);
  });

  test("never reports a negative pending count", () => {
    const result = aggregateEnrichmentStatus([
      status({ sentiment: { enabled: true, eligible: 10, done: 12 } }),
    ]);

    expect(result[0].pending).toBe(0);
  });

  test("treats an enrichment missing from the Hub response as disabled", () => {
    const partial = { tenant_id: "frd-1", translation: { enabled: true, eligible: 50, done: 25 } };

    const result = aggregateEnrichmentStatus([partial as EnrichmentStatusResponse]);

    expect(result).toEqual([{ kind: "translation", eligible: 50, done: 25, failedTerminal: 0, pending: 25 }]);
  });

  test("returns nothing when there are no directories", () => {
    expect(aggregateEnrichmentStatus([])).toEqual([]);
  });

  // ENG-2375: a record whose enrichment permanently gave up (content filter, refusal, truncation)
  // used to be silently folded into `eligible - done` and read as "still in progress" forever.
  test("excludes permanently-failed records from pending", () => {
    const result = aggregateEnrichmentStatus([
      status({ sentiment: { enabled: true, eligible: 100, done: 80, failed_terminal: 15 } }),
    ]);

    expect(result).toEqual([{ kind: "sentiment", eligible: 100, done: 80, failedTerminal: 15, pending: 5 }]);
  });

  test("sums failed_terminal across directories", () => {
    const result = aggregateEnrichmentStatus([
      status({ emotions: { enabled: true, eligible: 200, done: 150, failed_terminal: 10 } }),
      status({ emotions: { enabled: true, eligible: 100, done: 60, failed_terminal: 5 } }),
    ]);

    expect(result).toEqual([{ kind: "emotions", eligible: 300, done: 210, failedTerminal: 15, pending: 75 }]);
  });

  test("never reports a negative pending count when failed_terminal alone exceeds the remainder", () => {
    // Shouldn't happen per the Hub's own invariant (done + failed + failed_terminal <= eligible), but
    // clamp defensively rather than surface a negative number if it ever does.
    const result = aggregateEnrichmentStatus([
      status({ translation: { enabled: true, eligible: 10, done: 5, failed_terminal: 8 } }),
    ]);

    expect(result[0].pending).toBe(0);
  });

  test("treats a missing failed_terminal as zero, for a Hub that predates the field", () => {
    const result = aggregateEnrichmentStatus([
      status({ sentiment: { enabled: true, eligible: 50, done: 30 } }),
    ]);

    expect(result[0].failedTerminal).toBe(0);
    expect(result[0].pending).toBe(20);
  });
});
