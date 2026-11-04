/**
 * @vitest-environment jsdom
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { type ReactNode, createElement } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { mergeEmbeddedFields, useDashboardEmbeddedFields } from "./use-dashboard-embedded-fields";

const WORKSPACE_ID = "clws000000000000000000001";
const PLAN = "FeedbackRecords.ed_plan_64879f7d";
const TIER = "FeedbackRecords.ed_tier_0a1b2c3d";

const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>();
let wrapper: (props: Readonly<{ children: ReactNode }>) => ReturnType<typeof createElement>;

const catalog = (...fields: Array<{ name: string; label: string }>) =>
  Response.json({
    data: { fields: fields.map((field) => ({ ...field, kind: "dimension", type: "string" })) },
  });

describe("mergeEmbeddedFields", () => {
  test("has none for no datasets, or datasets without keys", () => {
    expect(mergeEmbeddedFields([])).toEqual([]);
    expect(mergeEmbeddedFields([[{ name: "FeedbackRecords.sourceName", label: "Source" }]])).toEqual([]);
  });

  test("keeps one field per key across datasets, in key order", () => {
    expect(
      mergeEmbeddedFields([
        [
          { name: TIER, label: "Tier" },
          { name: PLAN, label: "Plan" },
        ],
        [{ name: PLAN, label: "Plan" }],
      ])
    ).toEqual([
      { name: PLAN, key: "Plan" },
      { name: TIER, key: "Tier" },
    ]);
  });
});

describe("useDashboardEmbeddedFields", () => {
  beforeEach(() => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    wrapper = ({ children }) => createElement(QueryClientProvider, { client: queryClient }, children);
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  test("reads each dataset's catalog once, and only while enabled", async () => {
    fetchMock.mockImplementation(async (url) =>
      url.includes("datasetId=ds1")
        ? catalog({ name: PLAN, label: "Plan" })
        : catalog({ name: TIER, label: "Tier" })
    );

    const disabled = renderHook(() => useDashboardEmbeddedFields(WORKSPACE_ID, ["ds1", "ds2"], false), {
      wrapper,
    });
    expect(disabled.result.current).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();

    const { result } = renderHook(
      () => useDashboardEmbeddedFields(WORKSPACE_ID, ["ds1", "ds2", "ds1"], true),
      {
        wrapper,
      }
    );
    await waitFor(() => expect(result.current).toHaveLength(2));
    expect(result.current).toEqual([
      { name: PLAN, key: "Plan" },
      { name: TIER, key: "Tier" },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
