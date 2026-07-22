/**
 * @vitest-environment jsdom
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { type ReactNode, createElement } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { useWorkflowSurveyEndings, useWorkflowSurveyOptions } from "./use-trigger-survey-picker";

const { listSurveysMock } = vi.hoisted(() => ({ listSurveysMock: vi.fn() }));

vi.mock("@/modules/survey/list/lib/v3-surveys-client", () => ({
  listSurveys: listSurveysMock,
}));

function createWrapper(queryClient: QueryClient) {
  const Wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  Wrapper.displayName = "TriggerSurveyPickerTestWrapper";
  return Wrapper;
}

const newQueryClient = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });

const page = (data: Array<{ id: string; name: string }>, nextCursor: string | null) => ({
  data,
  meta: { nextCursor },
});

describe("useWorkflowSurveyOptions", () => {
  beforeEach(() => {
    listSurveysMock.mockReset();
  });

  test("walks every cursor page and flattens the surveys", async () => {
    listSurveysMock
      .mockResolvedValueOnce(page([{ id: "s1", name: "One" }], "cursor-1"))
      .mockResolvedValueOnce(page([{ id: "s2", name: "Two" }], null));

    const { result } = renderHook(() => useWorkflowSurveyOptions("ws_1"), {
      wrapper: createWrapper(newQueryClient()),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.options).toEqual([
      { id: "s1", name: "One" },
      { id: "s2", name: "Two" },
    ]);
    expect(listSurveysMock).toHaveBeenCalledTimes(2);
    expect(listSurveysMock).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: "cursor-1" }));
  });

  test("truncates and warns when the cursor never exhausts", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    // Always returns a cursor -> the MAX_PAGES break must stop the loop.
    listSurveysMock.mockResolvedValue(page([{ id: "s", name: "S" }], "always"));

    const { result } = renderHook(() => useWorkflowSurveyOptions("ws_1"), {
      wrapper: createWrapper(newQueryClient()),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(listSurveysMock).toHaveBeenCalledTimes(20);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("truncated"));
    warnSpy.mockRestore();
  });
});

describe("useWorkflowSurveyEndings", () => {
  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const jsonResponse = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });

  test("is disabled (no fetch) when surveyId is falsy", async () => {
    const fetchMock = vi.mocked(global.fetch);
    const { result } = renderHook(() => useWorkflowSurveyEndings(null), {
      wrapper: createWrapper(newQueryClient()),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.endings).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("derives labels for endScreen, redirectToUrl, and fallback endings", async () => {
    const fetchMock = vi.mocked(global.fetch);
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        data: {
          defaultLanguage: "en",
          endings: [
            { id: "end-1", type: "endScreen", headline: { en: "<p>Thanks!</p>" } },
            // default-language slot missing -> falls back to any other string value
            { id: "end-2", type: "endScreen", headline: { de: "Danke" } },
            { id: "end-3", type: "redirectToUrl", label: " Go home " },
            // unknown type -> falls back to the id
            { id: "end-4", type: "other" },
            // endScreen whose headline has no usable string -> falls back to the id
            { id: "end-5", type: "endScreen", headline: { en: "   " } },
            // missing id -> filtered out entirely
            { type: "endScreen", headline: { en: "no id" } },
          ],
        },
      })
    );

    const { result } = renderHook(() => useWorkflowSurveyEndings("survey_1"), {
      wrapper: createWrapper(newQueryClient()),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.endings).toEqual([
      { id: "end-1", label: "Thanks!" },
      { id: "end-2", label: "Danke" },
      { id: "end-3", label: "Go home" },
      { id: "end-4", label: "end-4" },
      { id: "end-5", label: "end-5" },
    ]);
  });

  test("returns [] when endings is not an array", async () => {
    const fetchMock = vi.mocked(global.fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: { endings: "nope" } }));

    const { result } = renderHook(() => useWorkflowSurveyEndings("survey_1"), {
      wrapper: createWrapper(newQueryClient()),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.endings).toEqual([]);
  });

  test("throws a parsed error when the response is not ok", async () => {
    const fetchMock = vi.mocked(global.fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse({ status: 404, detail: "Survey not found" }, 404));

    const { result } = renderHook(() => useWorkflowSurveyEndings("survey_1"), {
      wrapper: createWrapper(newQueryClient()),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.endings).toEqual([]);
  });
});
