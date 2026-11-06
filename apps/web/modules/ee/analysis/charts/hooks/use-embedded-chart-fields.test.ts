/**
 * @vitest-environment jsdom
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { type ReactNode, createElement } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { useEmbeddedChartFields } from "./use-embedded-chart-fields";

const WORKSPACE_ID = "clws000000000000000000001";
const DATASET_ID = "clds000000000000000000001";
const field = {
  id: "FeedbackRecords.ed_0123456789abcdef",
  name: "brand",
  type: "string",
  surveyNames: ["A"],
};

const render = (datasetId: string | null) =>
  renderHook(() => useEmbeddedChartFields(WORKSPACE_ID, datasetId), {
    wrapper: ({ children }: Readonly<{ children: ReactNode }>) =>
      createElement(
        QueryClientProvider,
        { client: new QueryClient({ defaultOptions: { queries: { retry: false } } }) },
        children
      ),
  });

describe("useEmbeddedChartFields (ENG-2848)", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("loads the dataset's fields from the internal route", async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json({ data: [field] }));

    const { result } = render(DATASET_ID);

    await waitFor(() => expect(result.current).toEqual([field]));
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe(
      `/api/internal/embedded-data-fields?workspaceId=${WORKSPACE_ID}&datasetId=${DATASET_ID}`
    );
  });

  test("offers no fields, and asks for none, before a dataset is picked", () => {
    const { result } = render(null);

    expect(result.current).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });

  test("offers no fields when the lookup fails, so the builder keeps its fixed ones", async () => {
    vi.mocked(fetch).mockResolvedValue(
      Response.json({ title: "Forbidden", status: 403, detail: "Forbidden" }, { status: 403 })
    );

    const { result } = render(DATASET_ID);

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(result.current).toEqual([]);
  });
});
