/**
 * @vitest-environment jsdom
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createQueryWrapper, jsonResponse as json, routeFetch } from "@/modules/api/lib/hook-test-utils";
import { useOrganizationSwitcherData, useWorkspaceSwitcherData } from "./use-switcher-data";

vi.mock("@formbricks/logger", () => ({ logger: { error: vi.fn() } }));

const ORG_ID = "clorg11111111111111111111";
const WORKSPACES_URL = `/api/internal/workspaces?organizationId=${ORG_ID}&access=read`;
const ORGANIZATIONS_URL = "/api/internal/organizations";
const FALLBACK = "common.failed_to_load_workspaces";

const BETA = { id: "clws222222222222222222222", name: "Beta" };
const ALPHA = { id: "clws111111111111111111111", name: "Alpha" };

const requests = () => vi.mocked(global.fetch).mock.calls.map(([url]) => String(url));

describe("useWorkspaceSwitcherData", () => {
  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("asks nothing until the dropdown first opens, then lists the workspaces sorted by name", async () => {
    routeFetch({ [`GET ${WORKSPACES_URL}`]: [json({ data: [BETA, ALPHA] })] });
    const { wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useWorkspaceSwitcherData(ORG_ID, { fallbackError: FALLBACK }), {
      wrapper,
    });

    expect(global.fetch).not.toHaveBeenCalled();
    expect(result.current.hasLoaded).toBe(false);

    act(() => result.current.load());

    await waitFor(() => expect(result.current.items).toEqual([ALPHA, BETA]));
    expect(result.current.hasLoaded).toBe(true);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  test("loads once, however often the dropdown opens", async () => {
    routeFetch({ [`GET ${WORKSPACES_URL}`]: [json({ data: [ALPHA] })] });
    const { wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useWorkspaceSwitcherData(ORG_ID, { fallbackError: FALLBACK }), {
      wrapper,
    });

    act(() => {
      result.current.load();
      result.current.load();
    });
    await waitFor(() => expect(result.current.hasLoaded).toBe(true));
    act(() => result.current.load());

    expect(requests()).toEqual([WORKSPACES_URL]);
  });

  test("shares one request between the switchers on a page (sidebar and breadcrumb)", async () => {
    routeFetch({ [`GET ${WORKSPACES_URL}`]: [json({ data: [ALPHA] })] });
    const { wrapper } = createQueryWrapper();
    const sidebar = renderHook(() => useWorkspaceSwitcherData(ORG_ID, { fallbackError: FALLBACK }), {
      wrapper,
    });
    const breadcrumb = renderHook(() => useWorkspaceSwitcherData(ORG_ID, { fallbackError: FALLBACK }), {
      wrapper,
    });

    act(() => sidebar.result.current.load());
    await waitFor(() => expect(sidebar.result.current.items).toEqual([ALPHA]));
    act(() => breadcrumb.result.current.load());

    expect(breadcrumb.result.current.items).toEqual([ALPHA]);
    expect(requests()).toEqual([WORKSPACES_URL]);
  });

  test("refetches once the current item is renamed (reloadKey)", async () => {
    routeFetch({
      [`GET ${WORKSPACES_URL}`]: [json({ data: [ALPHA] }), json({ data: [{ ...ALPHA, name: "Renamed" }] })],
    });
    const { wrapper } = createQueryWrapper();
    const { result, rerender } = renderHook(
      ({ reloadKey }) => useWorkspaceSwitcherData(ORG_ID, { fallbackError: FALLBACK, reloadKey }),
      { wrapper, initialProps: { reloadKey: "Alpha" } }
    );

    act(() => result.current.load());
    await waitFor(() => expect(result.current.items).toEqual([ALPHA]));
    rerender({ reloadKey: "Alpha" });
    expect(requests()).toHaveLength(1);

    rerender({ reloadKey: "Renamed" });

    await waitFor(() => expect(result.current.items).toEqual([{ ...ALPHA, name: "Renamed" }]));
    expect(requests()).toHaveLength(2);
  });

  test("surfaces the server's problem once, and retry() loads again and clears it", async () => {
    routeFetch({
      [`GET ${WORKSPACES_URL}`]: [
        json({ status: 403, detail: "You are not authorized to access this resource" }, 403),
        json({ data: [ALPHA] }),
      ],
    });
    const onError = vi.fn();
    const { wrapper } = createQueryWrapper();
    const { result, rerender } = renderHook(
      () => useWorkspaceSwitcherData(ORG_ID, { fallbackError: FALLBACK, onError: (m) => onError(m) }),
      { wrapper }
    );

    act(() => result.current.load());
    await waitFor(() => expect(result.current.error).toBe("You are not authorized to access this resource"));
    rerender();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith("You are not authorized to access this resource");
    expect(result.current.hasLoaded).toBe(true);

    act(() => result.current.retry());

    await waitFor(() => expect(result.current.items).toEqual([ALPHA]));
    expect(result.current.error).toBeNull();
    expect(requests()).toHaveLength(2);
  });

  test("shows a spinner, not the old error, while a retry is in flight", async () => {
    let answer: (response: Response) => void = () => {};
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(json({ status: 500, detail: "Boom" }, 500))
      .mockReturnValueOnce(new Promise<Response>((resolve) => (answer = resolve)));
    const { wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useWorkspaceSwitcherData(ORG_ID, { fallbackError: FALLBACK }), {
      wrapper,
    });
    act(() => result.current.load());
    await waitFor(() => expect(result.current.error).toBe("Boom"));

    act(() => result.current.retry());

    await waitFor(() => expect(result.current.isLoading).toBe(true));
    expect(result.current.error).toBeNull();
    await act(async () => answer(json({ data: [ALPHA] })));
    await waitFor(() => expect(result.current.items).toEqual([ALPHA]));
    expect(result.current.isLoading).toBe(false);
  });

  test("falls back to the translated message when the request never got an answer", async () => {
    vi.mocked(global.fetch).mockRejectedValue(new TypeError("Failed to fetch"));
    const { wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useWorkspaceSwitcherData(ORG_ID, { fallbackError: FALLBACK }), {
      wrapper,
    });

    act(() => result.current.load());

    await waitFor(() => expect(result.current.error).toBe(FALLBACK));
  });
});

describe("useOrganizationSwitcherData", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("lists the caller's organizations, sorted by name", async () => {
    routeFetch({ [`GET ${ORGANIZATIONS_URL}`]: [json({ data: [BETA, ALPHA] })] });
    const { wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useOrganizationSwitcherData({ fallbackError: FALLBACK }), {
      wrapper,
    });

    act(() => result.current.load());

    await waitFor(() => expect(result.current.items).toEqual([ALPHA, BETA]));
    expect(requests()).toEqual([ORGANIZATIONS_URL]);
  });
});
