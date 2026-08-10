import { after } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  enqueueAuthorizationComparison,
  getAuthorizationRolloutTarget,
  getIssuedAuthorizationCheckCount,
  recordAuthorizationCheckIssued,
  withAuthorizationSurface,
} from "./context";

const afterCallbacks = vi.hoisted(() => [] as Array<() => Promise<void> | void>);

vi.mock("next/server", () => ({
  after: vi.fn((callback: () => Promise<void> | void) => afterCallbacks.push(callback)),
}));

beforeEach(() => {
  afterCallbacks.length = 0;
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
  });
});
