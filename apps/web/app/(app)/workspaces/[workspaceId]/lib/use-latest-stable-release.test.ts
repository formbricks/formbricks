/**
 * @vitest-environment jsdom
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

const getLatestRelease = vi.fn();

vi.mock("@/modules/workspaces/settings/(setup)/app-connection/lib/api-client", () => ({
  getLatestRelease: (options: { signal?: AbortSignal }) => getLatestRelease(options),
}));

// Pin the running build's version so these assert the comparison rather than whatever
// apps/web/package.json happens to say. It currently reads 0.0.0, which makes every real tag look
// newer — tracked separately, and not something this test should bake in either way.
vi.mock("../../../../../package.json", () => ({ default: { version: "1.2.3" } }));

const { useLatestStableRelease } = await import("./use-latest-stable-release");

const NEWER = "v9.9.9";
const OLDER = "v1.0.0";
const SAME = "v1.2.3";

describe("useLatestStableRelease", () => {
  beforeEach(() => {
    getLatestRelease.mockReset();
  });

  test("surfaces the tag when the released version is newer than the running build", async () => {
    getLatestRelease.mockResolvedValue(NEWER);

    const { result } = renderHook(() => useLatestStableRelease(true));

    await waitFor(() => {
      expect(result.current).toBe(NEWER);
    });
  });

  test("stays empty when the released version is not newer", async () => {
    getLatestRelease.mockResolvedValue(OLDER);

    const { result } = renderHook(() => useLatestStableRelease(true));

    await waitFor(() => {
      expect(getLatestRelease).toHaveBeenCalled();
    });
    // No update prompt for an instance that is already ahead of the latest release.
    expect(result.current).toBe("");
  });

  test("stays empty when the released version matches the running build", async () => {
    getLatestRelease.mockResolvedValue(SAME);

    const { result } = renderHook(() => useLatestStableRelease(true));

    await waitFor(() => {
      expect(getLatestRelease).toHaveBeenCalled();
    });
    expect(result.current).toBe("");
  });

  test("does not check at all for a member", async () => {
    const { result } = renderHook(() => useLatestStableRelease(false));

    // Nobody but an owner/manager is shown the prompt, so the request is not worth making.
    expect(getLatestRelease).not.toHaveBeenCalled();
    expect(result.current).toBe("");
  });

  test("stays empty when there is no tag to compare", async () => {
    getLatestRelease.mockResolvedValue(null);

    const { result } = renderHook(() => useLatestStableRelease(true));

    await waitFor(() => {
      expect(getLatestRelease).toHaveBeenCalled();
    });
    expect(result.current).toBe("");
  });

  test("stays empty when the check fails", async () => {
    // A failed request must not surface as an error, or as a prompt.
    getLatestRelease.mockRejectedValue(new Error("Service Unavailable"));

    const { result } = renderHook(() => useLatestStableRelease(true));

    await waitFor(() => {
      expect(getLatestRelease).toHaveBeenCalled();
    });
    expect(result.current).toBe("");
  });

  test("ignores a stale response that resolves after a newer one", async () => {
    // Role flips true -> false -> true, so two requests exist at once. The first is stale by the
    // time it lands; without the cleanup guard its result overwrites the newer one.
    const resolvers: ((value: string) => void)[] = [];
    getLatestRelease.mockImplementation(() => new Promise((resolve) => resolvers.push(resolve)));

    const { result, rerender } = renderHook(({ owner }) => useLatestStableRelease(owner), {
      initialProps: { owner: true },
    });
    await waitFor(() => {
      expect(resolvers).toHaveLength(1);
    });

    rerender({ owner: false });
    rerender({ owner: true });
    await waitFor(() => {
      expect(resolvers).toHaveLength(2);
    });

    // Newest request answers first, then the abandoned one.
    resolvers[1](NEWER);
    await waitFor(() => {
      expect(result.current).toBe(NEWER);
    });
    // act() flushes the stale callback and any state update it triggers, so this asserts the
    // update did not happen rather than racing it.
    await act(async () => {
      resolvers[0]("v5.0.0");
    });

    expect(result.current).toBe(NEWER);
  });

  test("aborts the request when the role changes", async () => {
    getLatestRelease.mockImplementation(() => new Promise(() => {}));
    const { rerender } = renderHook(({ owner }) => useLatestStableRelease(owner), {
      initialProps: { owner: true },
    });
    await waitFor(() => {
      expect(getLatestRelease).toHaveBeenCalledTimes(1);
    });

    rerender({ owner: false });

    expect((getLatestRelease.mock.calls[0][0] as { signal: AbortSignal }).signal.aborted).toBe(true);
  });

  test("checks once when the role does not change", async () => {
    getLatestRelease.mockResolvedValue(NEWER);

    const { rerender } = renderHook(() => useLatestStableRelease(true));

    await waitFor(() => {
      expect(getLatestRelease).toHaveBeenCalledTimes(1);
    });

    rerender();
    rerender();

    expect(getLatestRelease).toHaveBeenCalledTimes(1);
  });
});
