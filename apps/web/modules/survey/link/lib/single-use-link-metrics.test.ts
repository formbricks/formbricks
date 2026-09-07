import { beforeEach, describe, expect, test, vi } from "vitest";
import type { TSurveySingleUseLinkRejectionReason } from "@/lib/utils/single-use-surveys";

const counters = new Map<string, { add: ReturnType<typeof vi.fn> }>();

vi.mock("server-only", () => ({}));

vi.mock("@opentelemetry/api", () => ({
  metrics: {
    getMeter: vi.fn(() => ({
      createCounter: vi.fn((name: string) => {
        const instrument = { add: vi.fn() };
        counters.set(name, instrument);
        return instrument;
      }),
    })),
  },
}));

const { recordSingleUseLinkValidation } = await import("./single-use-link-metrics");

const COUNTER = "formbricks_survey_single_use_link_validations_total";

beforeEach(() => {
  for (const instrument of counters.values()) instrument.add.mockClear();
});

describe("single-use link validation metrics", () => {
  const REJECTION_REASONS: TSurveySingleUseLinkRejectionReason[] = [
    "missing_su_id",
    "missing_signature",
    "signature_mismatch",
    "decryption_failed",
    "not_a_cuid",
  ];

  test.each(REJECTION_REASONS)("counts a %s rejection with bounded attributes only", (reason) => {
    recordSingleUseLinkValidation({
      mode: "encrypted",
      outcome: "rejected",
      reason,
      surface: "client_response_v2",
    });

    // Bounded on purpose: a surveyId label is unbounded cardinality, and a suId or token label would
    // put a live credential into a metrics backend. Which survey was probed belongs in the log line.
    expect(counters.get(COUNTER)?.add).toHaveBeenCalledWith(1, {
      mode: "encrypted",
      outcome: "rejected",
      reason,
      surface: "client_response_v2",
    });
  });

  test('counts an accepted link with reason "none" so one series sums cleanly', () => {
    recordSingleUseLinkValidation({
      mode: "plaintext",
      outcome: "accepted",
      reason: "none",
      surface: "link_page",
    });

    expect(counters.get(COUNTER)?.add).toHaveBeenCalledWith(1, {
      mode: "plaintext",
      outcome: "accepted",
      reason: "none",
      surface: "link_page",
    });
  });

  test("never lets a meter failure change the outcome of a validation", () => {
    counters.get(COUNTER)!.add.mockImplementationOnce(() => {
      throw new Error("exporter unavailable");
    });

    expect(() =>
      recordSingleUseLinkValidation({
        mode: "encrypted",
        outcome: "rejected",
        reason: "signature_mismatch",
        surface: "link_page",
      })
    ).not.toThrow();
  });
});
