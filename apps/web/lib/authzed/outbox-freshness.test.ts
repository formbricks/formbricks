import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { hasStaleAuthzedRevocation } from "./outbox-repository";

vi.mock("./outbox-repository", () => ({ hasStaleAuthzedRevocation: vi.fn() }));

/**
 * Each test imports the module fresh, because the memo is module state on purpose: React's `cache()`
 * used to sit here and silently did nothing in Route Handlers, which is where nine of the eleven
 * rollout targets live.
 */
const loadGuard = async () => {
  vi.resetModules();
  return import("./outbox-freshness");
};

describe("AuthZed projection freshness guard", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.useRealTimers());

  test("allows a fresh graph", async () => {
    vi.mocked(hasStaleAuthzedRevocation).mockResolvedValue(false);
    const { assertAuthzedProjectionFreshness } = await loadGuard();

    await expect(assertAuthzedProjectionFreshness()).resolves.toBeUndefined();
  });

  test("fails closed for an overdue or dead-letter revocation", async () => {
    vi.mocked(hasStaleAuthzedRevocation).mockResolvedValue(true);
    const { assertAuthzedProjectionFreshness } = await loadGuard();

    await expect(assertAuthzedProjectionFreshness()).rejects.toMatchObject({
      code: "authzed_projection_stale",
      retryable: false,
    });
  });

  test("collapses a fan-out of concurrent checks into one query", async () => {
    // A request makes many checks — three for workspace navigation, one per directory in the
    // feedback-directory fan-out — and they all start before any of them finishes.
    let release: (stale: boolean) => void = () => undefined;
    vi.mocked(hasStaleAuthzedRevocation).mockReturnValue(
      new Promise<boolean>((resolve) => {
        release = resolve;
      })
    );
    const { assertAuthzedProjectionFreshness } = await loadGuard();

    const checks = Promise.all(Array.from({ length: 5 }, () => assertAuthzedProjectionFreshness()));
    release(false);

    await expect(checks).resolves.toHaveLength(5);
    expect(hasStaleAuthzedRevocation).toHaveBeenCalledOnce();
  });

  test("re-reads once the memo window has elapsed", async () => {
    vi.useFakeTimers();
    vi.mocked(hasStaleAuthzedRevocation).mockResolvedValue(false);
    const { AUTHZED_FRESHNESS_MEMO_TTL_MS, assertAuthzedProjectionFreshness } = await loadGuard();

    await assertAuthzedProjectionFreshness();
    await assertAuthzedProjectionFreshness();
    expect(hasStaleAuthzedRevocation).toHaveBeenCalledOnce();

    vi.advanceTimersByTime(AUTHZED_FRESHNESS_MEMO_TTL_MS);
    await assertAuthzedProjectionFreshness();
    expect(hasStaleAuthzedRevocation).toHaveBeenCalledTimes(2);
  });

  test("keeps denying rather than memoizing a failed read", async () => {
    vi.mocked(hasStaleAuthzedRevocation)
      .mockRejectedValueOnce(new Error("connection terminated"))
      .mockResolvedValue(false);
    const { assertAuthzedProjectionFreshness } = await loadGuard();

    await expect(assertAuthzedProjectionFreshness()).rejects.toThrow("connection terminated");
    // The rejection is not an answer, so the next check must ask again rather than reuse it.
    await expect(assertAuthzedProjectionFreshness()).resolves.toBeUndefined();
    expect(hasStaleAuthzedRevocation).toHaveBeenCalledTimes(2);
  });
});
