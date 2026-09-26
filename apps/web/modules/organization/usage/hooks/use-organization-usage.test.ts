/**
 * @vitest-environment jsdom
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { type ReactNode, createElement } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { TUsageRangeQuery } from "../lib/range";
import { useOrganizationUsage } from "./use-organization-usage";

const ORG_ID = "clorg11111111111111111111";

function createWrapper(queryClient: QueryClient) {
  const Wrapper = ({ children }: Readonly<{ children: ReactNode }>) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  Wrapper.displayName = "UseOrganizationUsageTestWrapper";
  return Wrapper;
}

const createQueryClient = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });

const usageResponse = (responseCount: number) =>
  new Response(JSON.stringify({ data: { totals: { responseCount, workflowRunCount: null } } }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

describe("useOrganizationUsage", () => {
  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("asks the usage route for a preset", async () => {
    vi.mocked(global.fetch).mockResolvedValue(usageResponse(70));

    const { result } = renderHook(
      () => useOrganizationUsage({ organizationId: ORG_ID, range: { preset: "this_year" } }),
      { wrapper: createWrapper(createQueryClient()) }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.totals.responseCount).toBe(70);
    expect(global.fetch).toHaveBeenCalledWith(
      `/api/organizations/${ORG_ID}/usage?preset=this_year`,
      expect.objectContaining({ method: "GET", cache: "no-store" })
    );
  });

  test("sends a custom range as from and to, never with a preset", async () => {
    vi.mocked(global.fetch).mockResolvedValue(usageResponse(12));

    const { result } = renderHook(
      () => useOrganizationUsage({ organizationId: ORG_ID, range: { from: "2026-01-01", to: "2026-01-31" } }),
      { wrapper: createWrapper(createQueryClient()) }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(global.fetch).toHaveBeenCalledWith(
      `/api/organizations/${ORG_ID}/usage?from=2026-01-01&to=2026-01-31`,
      expect.anything()
    );
  });

  test("keys each range separately, so returning to a range seen before does not refetch", async () => {
    vi.mocked(global.fetch).mockImplementation(async (url) =>
      usageResponse(String(url).includes("all_time") ? 109 : 70)
    );
    const { result, rerender } = renderHook(
      ({ range }: { range: TUsageRangeQuery }) => useOrganizationUsage({ organizationId: ORG_ID, range }),
      {
        wrapper: createWrapper(createQueryClient()),
        initialProps: { range: { preset: "this_year" } as TUsageRangeQuery },
      }
    );
    await waitFor(() => expect(result.current.data?.totals.responseCount).toBe(70));

    rerender({ range: { preset: "all_time" } });
    await waitFor(() => expect(result.current.data?.totals.responseCount).toBe(109));

    rerender({ range: { preset: "this_year" } });
    await waitFor(() => expect(result.current.data?.totals.responseCount).toBe(70));
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  test("surfaces a refused request as an error with its status", async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      new Response(JSON.stringify({ status: 403, detail: "Forbidden", code: "forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/problem+json" },
      })
    );

    const { result } = renderHook(
      () => useOrganizationUsage({ organizationId: ORG_ID, range: { preset: "all_time" } }),
      { wrapper: createWrapper(createQueryClient()) }
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({ status: 403 });
  });
});
