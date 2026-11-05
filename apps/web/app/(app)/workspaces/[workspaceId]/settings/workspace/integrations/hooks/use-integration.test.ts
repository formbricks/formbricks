/**
 * @vitest-environment jsdom
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { type ReactNode, createElement } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { TIntegrationGoogleSheets } from "@formbricks/types/integration/google-sheet";
import { integrationKeys } from "../lib/query";
import { useIntegration } from "./use-integration";

const WORKSPACE_ID = "clws111111111111111111111";

const integration = {
  id: "int_1",
  type: "googleSheets",
  workspaceId: WORKSPACE_ID,
  config: {
    email: "sheets@example.com",
    data: [{ spreadsheetName: "Responses", createdAt: new Date("2026-01-01T00:00:00.000Z") }],
  },
} as unknown as TIntegrationGoogleSheets;

const wrapperFor = (queryClient: QueryClient) => {
  const Wrapper = ({ children }: Readonly<{ children: ReactNode }>) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  Wrapper.displayName = "UseIntegrationTestWrapper";
  return Wrapper;
};

const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>();

describe("useIntegration", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("serves the server-rendered integration without a request", () => {
    const { result } = renderHook(() => useIntegration(WORKSPACE_ID, "googleSheets", integration), {
      wrapper: wrapperFor(queryClient),
    });

    expect(result.current).toBe(integration);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("returns undefined when the workspace has no integration of that type", () => {
    const { result } = renderHook(() => useIntegration(WORKSPACE_ID, "googleSheets", undefined), {
      wrapper: wrapperFor(queryClient),
    });

    expect(result.current).toBeUndefined();
  });

  test("refetches the integration when its query is invalidated", async () => {
    fetchMock.mockResolvedValue(
      Response.json({
        data: { ...integration, config: { ...integration.config, data: [] } },
      })
    );
    const { result } = renderHook(() => useIntegration(WORKSPACE_ID, "googleSheets", integration), {
      wrapper: wrapperFor(queryClient),
    });

    await act(() =>
      queryClient.invalidateQueries({ queryKey: integrationKeys.byType(WORKSPACE_ID, "googleSheets") })
    );

    await waitFor(() => expect(result.current?.config.data).toEqual([]));
    expect(fetchMock.mock.calls[0][0]).toBe(`/api/workspaces/${WORKSPACE_ID}/integrations/googleSheets`);
  });

  test("drops the integration once its query is set to null", async () => {
    const { result } = renderHook(() => useIntegration(WORKSPACE_ID, "googleSheets", integration), {
      wrapper: wrapperFor(queryClient),
    });

    act(() => {
      queryClient.setQueryData(integrationKeys.byType(WORKSPACE_ID, "googleSheets"), null);
    });

    await waitFor(() => expect(result.current).toBeUndefined());
  });
});
