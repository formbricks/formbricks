/**
 * @vitest-environment jsdom
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { type ReactNode, createElement } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { useDashboardEmbeddedFields } from "./use-dashboard-embedded-fields";

const DASHBOARD_ID = "cldb000000000000000000001";
const PLAN = "FeedbackRecords.ed_plan_64879f7d";
const TIER = "FeedbackRecords.ed_tier_0a1b2c3d";

const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>();
let wrapper: (props: Readonly<{ children: ReactNode }>) => ReturnType<typeof createElement>;

const fieldsResponse = (...fields: Array<{ name: string; key: string }>) =>
  Response.json({ data: { fields: fields.map((field) => ({ ...field, label: field.key })) } });

describe("useDashboardEmbeddedFields", () => {
  beforeEach(() => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    wrapper = ({ children }) => createElement(QueryClientProvider, { client: queryClient }, children);
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  test("reads the dashboard's filter fields once, through the dashboard, and only while enabled", async () => {
    fetchMock.mockImplementation(async () =>
      fieldsResponse({ name: PLAN, key: "Plan" }, { name: TIER, key: "Tier" })
    );

    const disabled = renderHook(
      () => useDashboardEmbeddedFields({ dashboardId: DASHBOARD_ID, datasetIds: ["ds1"], enabled: false }),
      { wrapper }
    );
    expect(disabled.result.current.embeddedFields).toEqual([]);
    expect(disabled.result.current.isLoading).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();

    const { result } = renderHook(
      () => useDashboardEmbeddedFields({ dashboardId: DASHBOARD_ID, datasetIds: ["ds1", "ds2", "ds1"] }),
      { wrapper }
    );
    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.embeddedFields).toHaveLength(2));
    expect(result.current.error).toBeNull();
    expect(result.current.embeddedFields).toEqual([
      { name: PLAN, key: "Plan" },
      { name: TIER, key: "Tier" },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(`/api/v3/dashboards/${DASHBOARD_ID}/filter-fields`);
  });

  test("asks nothing for a dashboard without charts", () => {
    const { result } = renderHook(
      () => useDashboardEmbeddedFields({ dashboardId: DASHBOARD_ID, datasetIds: [] }),
      { wrapper }
    );
    expect(result.current.embeddedFields).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("reports a failed read so the editor can say so and retry, instead of raw member names", async () => {
    fetchMock.mockImplementation(async () =>
      Response.json({ title: "Boom", status: 500, detail: "Boom" }, { status: 500 })
    );

    const { result } = renderHook(
      () => useDashboardEmbeddedFields({ dashboardId: DASHBOARD_ID, datasetIds: ["ds1"] }),
      { wrapper }
    );
    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect(result.current.isLoading).toBe(false);
    expect(result.current.embeddedFields).toEqual([]);

    fetchMock.mockImplementation(async () => fieldsResponse({ name: PLAN, key: "Plan" }));
    result.current.retry();
    await waitFor(() => expect(result.current.embeddedFields).toHaveLength(1));
    expect(result.current.error).toBeNull();
  });
});
