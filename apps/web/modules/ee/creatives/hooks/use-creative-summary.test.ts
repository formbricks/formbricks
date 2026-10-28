/**
 * @vitest-environment jsdom
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { type ReactNode, createElement } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { useCreativeStats } from "./use-creative-summary";

const CREATIVE_ID = "clcr1234567890123456789012";

const createWrapper = (queryClient: QueryClient) => {
  const Wrapper = ({ children }: Readonly<{ children: ReactNode }>) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  Wrapper.displayName = "UseCreativeStatsTestWrapper";
  return Wrapper;
};

/** The stats route's answer, tagged with the range it was asked for. */
const answerWithRange = async (input: RequestInfo | URL) => {
  const url = new URL(String(input), "https://app.formbricks.test");
  return new Response(JSON.stringify({ data: { to: url.searchParams.get("to") } }), { status: 200 });
};

const requestedTo = () =>
  vi
    .mocked(global.fetch)
    .mock.calls.map(([input]) =>
      new URL(String(input), "https://app.formbricks.test").searchParams.get("to")
    );

describe("useCreativeStats", () => {
  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.stubGlobal("fetch", vi.fn(answerWithRange));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  test("a refresh after UTC midnight fetches the rolling range that now ends today", async () => {
    vi.setSystemTime(new Date("2026-10-25T23:59:00Z"));
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useCreativeStats(CREATIVE_ID), {
      wrapper: createWrapper(queryClient),
    });
    await waitFor(() => expect(result.current.stats.data).toEqual({ to: "2026-10-25" }));

    vi.setSystemTime(new Date("2026-10-26T00:01:00Z"));
    // Started in a synchronous `act`, as a click handler does: React renders before the fetch settles.
    let refreshing = Promise.resolve();
    act(() => {
      refreshing = result.current.refresh();
    });
    await act(() => refreshing);

    expect(result.current.range).toEqual({ from: "2026-09-27", to: "2026-10-26" });
    await waitFor(() => expect(result.current.stats.data).toEqual({ to: "2026-10-26" }));
    // One request for the new range: the switch to its query doesn't fetch it a second time.
    expect(requestedTo()).toEqual(["2026-10-25", "2026-10-26"]);
  });
});
