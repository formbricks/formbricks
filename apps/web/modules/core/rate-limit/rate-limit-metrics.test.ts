import { beforeEach, describe, expect, test, vi } from "vitest";

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

const { recordRateLimiterUnavailable } = await import("./rate-limit-metrics");

const COUNTER = "formbricks_rate_limiter_unavailable_total";

beforeEach(() => {
  for (const instrument of counters.values()) instrument.add.mockClear();
});

describe("rate limiter unavailable metric", () => {
  test.each([
    ["closed", "no_client"],
    ["closed", "error"],
    ["open", "no_client"],
    ["open", "error"],
  ] as const)("counts a %s limit that hit %s with bounded attributes only", (failMode, reason) => {
    recordRateLimiterUnavailable({ failMode, reason });

    // The attribute names are what the documented alert query sums over (rate-limiting.mdx), and no
    // namespace or identifier: a user id or hashed IP label is unbounded cardinality.
    expect(counters.get(COUNTER)?.add).toHaveBeenCalledWith(1, { fail_mode: failMode, reason });
  });

  test("never lets a meter failure change the limiter's decision", () => {
    counters.get(COUNTER)!.add.mockImplementationOnce(() => {
      throw new Error("exporter unavailable");
    });

    expect(() => recordRateLimiterUnavailable({ failMode: "closed", reason: "error" })).not.toThrow();
  });
});
