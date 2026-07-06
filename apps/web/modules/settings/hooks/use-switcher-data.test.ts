/**
 * @vitest-environment jsdom
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

vi.mock("@/lib/utils/helper", () => ({
  getFormattedErrorMessage: (result: { serverError?: string }) => result?.serverError ?? "",
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const { useSwitcherData } = await import("./use-switcher-data");

const FALLBACK = "common.failed_to_load_organizations";

describe("useSwitcherData", () => {
  test("loads items and sorts them by name", async () => {
    const loader = vi.fn().mockResolvedValue({
      data: [
        { id: "2", name: "Beta" },
        { id: "1", name: "Alpha" },
      ],
    });
    const { result } = renderHook(() => useSwitcherData(loader, FALLBACK));

    await act(async () => {
      await result.current.load();
    });

    expect(loader).toHaveBeenCalledTimes(1);
    expect(result.current.items).toEqual([
      { id: "1", name: "Alpha" },
      { id: "2", name: "Beta" },
    ]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  test("does not reload once populated", async () => {
    const loader = vi.fn().mockResolvedValue({ data: [{ id: "1", name: "Alpha" }] });
    const { result } = renderHook(() => useSwitcherData(loader, FALLBACK));

    await act(async () => {
      await result.current.load();
    });
    await act(async () => {
      await result.current.load();
    });

    expect(loader).toHaveBeenCalledTimes(1);
  });

  test("surfaces a server error, falling back to the provided key", async () => {
    const loader = vi.fn().mockResolvedValue({ serverError: "boom" });
    const { result } = renderHook(() => useSwitcherData(loader, FALLBACK));

    await act(async () => {
      await result.current.load();
    });
    expect(result.current.error).toBe("boom");

    const loaderNoMsg = vi.fn().mockResolvedValue({});
    const { result: result2 } = renderHook(() => useSwitcherData(loaderNoMsg, FALLBACK));
    await act(async () => {
      await result2.current.load();
    });
    expect(result2.current.error).toBe(FALLBACK);
  });

  test("does not reload while an error is showing, but retry() forces a reload", async () => {
    const loader = vi
      .fn()
      .mockResolvedValueOnce({ serverError: "boom" })
      .mockResolvedValueOnce({ data: [{ id: "1", name: "Alpha" }] });
    const { result } = renderHook(() => useSwitcherData(loader, FALLBACK));

    await act(async () => {
      await result.current.load();
    });
    expect(result.current.error).toBe("boom");

    // Guarded: a plain load() while errored is a no-op.
    await act(async () => {
      await result.current.load();
    });
    expect(loader).toHaveBeenCalledTimes(1);

    // retry() forces a fresh load.
    await act(async () => {
      result.current.retry();
    });
    await waitFor(() => expect(result.current.items).toEqual([{ id: "1", name: "Alpha" }]));
    expect(loader).toHaveBeenCalledTimes(2);
    expect(result.current.error).toBeNull();
  });

  test("uses fallbackError for unexpected thrown errors in catch block", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const loader = vi.fn().mockRejectedValue(new Error("raw DB error"));
    const { result } = renderHook(() => useSwitcherData(loader, FALLBACK));

    await act(async () => {
      await result.current.load();
    });

    expect(result.current.error).toBe(FALLBACK);
    consoleSpy.mockRestore();
  });

  test("avoids duplicate fetches when load() is called in rapid succession", async () => {
    let resolveLoader: (value: any) => void = () => {};
    const loaderPromise = new Promise((resolve) => {
      resolveLoader = resolve;
    });
    const loader = vi.fn().mockReturnValue(loaderPromise);
    const { result } = renderHook(() => useSwitcherData(loader, FALLBACK));

    act(() => {
      void result.current.load();
      void result.current.load();
    });

    await act(async () => {
      resolveLoader({ data: [{ id: "1", name: "Alpha" }] });
      await loaderPromise;
    });

    expect(loader).toHaveBeenCalledTimes(1);
  });
});
