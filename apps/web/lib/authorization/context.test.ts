import { after } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  enqueueAuthorizationComparison,
  getAuthorizationRolloutTarget,
  getIssuedAuthorizationCheckCount,
  recordAuthorizationCheckIssued,
  withAuthorizationSurface,
} from "./context";
import { recordAuthorizationChecksPerRequest } from "./metrics";

const afterCallbacks = vi.hoisted(() => [] as Array<() => Promise<void> | void>);

vi.mock("next/server", () => ({
  after: vi.fn((callback: () => Promise<void> | void) => afterCallbacks.push(callback)),
}));

// The histogram itself is covered against a real MeterProvider in `checks-per-request-metric.test.ts`.
// Here it is a mock so this file can assert the *wiring* — that recording happens, with the right
// arguments, and that a failure in it cannot take out the comparison drain.
vi.mock("./metrics", () => ({ recordAuthorizationChecksPerRequest: vi.fn() }));

beforeEach(() => {
  afterCallbacks.length = 0;
  vi.mocked(recordAuthorizationChecksPerRequest).mockReset();
  vi.mocked(after)
    .mockReset()
    .mockImplementation((callback) => afterCallbacks.push(callback));
});

describe("authorization request context", () => {
  test("exposes the current target and drains comparisons after the response", async () => {
    const job = vi.fn().mockResolvedValue(undefined);

    await withAuthorizationSurface("server_action", async () => {
      expect(getAuthorizationRolloutTarget("user")).toBe("server_action:user");
      expect(enqueueAuthorizationComparison(job)).toBe(true);
      expect(job).not.toHaveBeenCalled();
    });

    expect(afterCallbacks).toHaveLength(1);
    await afterCallbacks[0]();
    expect(job).toHaveBeenCalledOnce();
  });

  test("preserves the outer surface across nested wrappers", async () => {
    await withAuthorizationSurface("api_v1", () =>
      withAuthorizationSurface("api_v3", async () => {
        expect(getAuthorizationRolloutTarget("user")).toBe("api_v1:user");
      })
    );

    expect(afterCallbacks).toHaveLength(1);
  });

  test("isolates concurrent request surfaces", async () => {
    const observed = await Promise.all([
      withAuthorizationSurface("api_v1", async () => {
        await Promise.resolve();
        return getAuthorizationRolloutTarget("apiKey");
      }),
      withAuthorizationSurface("mcp", async () => {
        await Promise.resolve();
        return getAuthorizationRolloutTarget("user");
      }),
    ]);

    expect(observed).toEqual(["api_v1:apiKey", "mcp:user"]);
    expect(afterCallbacks).toHaveLength(2);
  });

  test("returns null for unsupported surface/actor combinations", async () => {
    await withAuthorizationSurface("api_v2", async () => {
      expect(getAuthorizationRolloutTarget("user")).toBeNull();
      expect(getAuthorizationRolloutTarget("apiKey")).toBe("api_v2:apiKey");
    });
  });

  test("maps both authenticated feedback gateway principal types", async () => {
    await withAuthorizationSurface("feedback_gateway", async () => {
      expect(getAuthorizationRolloutTarget("user")).toBe("feedback_gateway:user");
      expect(getAuthorizationRolloutTarget("apiKey")).toBe("feedback_gateway:apiKey");
    });
  });

  // ENG-2388: the server-rendered route surface. A page decision reaching the coordinator without
  // a target is the exact bug this surface exists to fix — it short-circuits to the legacy
  // evaluator and schedules no shadow comparison, so the decision is correct but invisible.
  test("resolves the page surface for session users, and only for session users", async () => {
    await withAuthorizationSurface("page", async () => {
      expect(getAuthorizationRolloutTarget("user")).toBe("page:user");
      // Deliberate asymmetry: pages are session-authenticated. There is no `page:apiKey` target,
      // so an API-key actor on this surface stays on the legacy path rather than silently
      // acquiring a rollout cohort it was never meant to be part of.
      expect(getAuthorizationRolloutTarget("apiKey")).toBeNull();
    });
  });

  test("does not accept comparison work outside a request context", () => {
    expect(getAuthorizationRolloutTarget("user")).toBeNull();
    expect(enqueueAuthorizationComparison(vi.fn())).toBe(false);
  });

  test("returns the callback result but rejects comparison work when after is unavailable", async () => {
    vi.mocked(after).mockImplementationOnce(() => {
      throw new Error("after is unavailable");
    });

    const result = await withAuthorizationSurface("server_action", async () => {
      expect(enqueueAuthorizationComparison(vi.fn())).toBe(false);
      return "completed";
    });

    expect(result).toBe("completed");
    expect(afterCallbacks).toHaveLength(0);
  });

  test("caps deferred comparison work per request", async () => {
    await withAuthorizationSurface("server_action", async () => {
      for (let index = 0; index < 100; index += 1) {
        expect(enqueueAuthorizationComparison(vi.fn())).toBe(true);
      }
      expect(enqueueAuthorizationComparison(vi.fn())).toBe(false);
    });
  });

  test("drains comparisons with at most four concurrent jobs", async () => {
    let active = 0;
    let maximumActive = 0;
    const releases: Array<() => void> = [];

    await withAuthorizationSurface("server_action", async () => {
      for (let index = 0; index < 5; index += 1) {
        enqueueAuthorizationComparison(
          () =>
            new Promise<void>((resolve) => {
              active += 1;
              maximumActive = Math.max(maximumActive, active);
              releases.push(() => {
                active -= 1;
                resolve();
              });
            })
        );
      }
    });

    const draining = afterCallbacks[0]();
    await vi.waitFor(() => expect(releases).toHaveLength(4));
    releases.splice(0).forEach((release) => release());
    await vi.waitFor(() => expect(releases).toHaveLength(1));
    releases.splice(0).forEach((release) => release());
    await draining;

    expect(maximumActive).toBe(4);
  });

  // ENG-1739: the per-request check counter. `can()` calls `recordAuthorizationCheckIssued`, not
  // exercised here — these pin the primitive it is built on.
  describe("authorization check counter", () => {
    test("counts each recorded check within a surface", async () => {
      await withAuthorizationSurface("server_action", async () => {
        expect(getIssuedAuthorizationCheckCount()).toBe(0);
        recordAuthorizationCheckIssued();
        recordAuthorizationCheckIssued();
        expect(getIssuedAuthorizationCheckCount()).toBe(2);
        recordAuthorizationCheckIssued();
        expect(getIssuedAuthorizationCheckCount()).toBe(3);
      });
    });

    test("is null outside a surface, and recording outside one is a no-op", () => {
      expect(getIssuedAuthorizationCheckCount()).toBeNull();
      expect(() => recordAuthorizationCheckIssued()).not.toThrow();
      expect(getIssuedAuthorizationCheckCount()).toBeNull();
    });

    test("starts fresh for each new surface rather than carrying a count over", async () => {
      await withAuthorizationSurface("server_action", async () => {
        recordAuthorizationCheckIssued();
        recordAuthorizationCheckIssued();
        expect(getIssuedAuthorizationCheckCount()).toBe(2);
      });

      await withAuthorizationSurface("server_action", async () => {
        expect(getIssuedAuthorizationCheckCount()).toBe(0);
      });
    });

    test("keeps concurrent surfaces' counts independent", async () => {
      const counts = await Promise.all([
        withAuthorizationSurface("api_v1", async () => {
          recordAuthorizationCheckIssued();
          await Promise.resolve();
          recordAuthorizationCheckIssued();
          recordAuthorizationCheckIssued();
          return getIssuedAuthorizationCheckCount();
        }),
        withAuthorizationSurface("mcp", async () => {
          recordAuthorizationCheckIssued();
          await Promise.resolve();
          return getIssuedAuthorizationCheckCount();
        }),
      ]);

      expect(counts).toEqual([3, 1]);
    });

    test("nested wrappers accumulate onto the outer surface's count", async () => {
      await withAuthorizationSurface("api_v1", () =>
        withAuthorizationSurface("api_v3", async () => {
          recordAuthorizationCheckIssued();
          recordAuthorizationCheckIssued();
          expect(getIssuedAuthorizationCheckCount()).toBe(2);
        })
      );
    });

    test("reports the request's total to the histogram, tagged by surface", async () => {
      await withAuthorizationSurface("api_v3", async () => {
        recordAuthorizationCheckIssued();
        recordAuthorizationCheckIssued();
      });

      expect(recordAuthorizationChecksPerRequest).not.toHaveBeenCalled();
      await afterCallbacks[0]();
      expect(recordAuthorizationChecksPerRequest).toHaveBeenCalledExactlyOnceWith(2, "api_v3");
    });

    test("records zero for a request that never authorized anything", async () => {
      await withAuthorizationSurface("server_action", async () => undefined);

      await afterCallbacks[0]();
      // Not skipped: "this request made no authorization decisions" is a real, distinguishable
      // observation, which is why the histogram's lowest boundary separates 0 from 1.
      expect(recordAuthorizationChecksPerRequest).toHaveBeenCalledExactlyOnceWith(0, "server_action");
    });

    test("a throwing histogram record does not stop the comparison drain", async () => {
      vi.mocked(recordAuthorizationChecksPerRequest).mockImplementationOnce(() => {
        throw new Error("meter provider exploded");
      });
      const job = vi.fn().mockResolvedValue(undefined);

      await withAuthorizationSurface("server_action", async () => {
        expect(enqueueAuthorizationComparison(job)).toBe(true);
      });

      // Next swallows errors thrown from `after()`, so an unguarded record would silently drop the
      // shadow comparisons for this request rather than surfacing anything.
      await expect(afterCallbacks[0]()).resolves.not.toThrow();
      expect(job).toHaveBeenCalledOnce();
    });
  });
});
