/**
 * @vitest-environment jsdom
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { type ReactNode, createElement } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { saveBlobAsFile } from "@/lib/utils/file-download";
import { V3ApiError } from "@/modules/api/lib/v3-client";
import { useExportSurvey } from "./use-export-survey";

vi.mock("@/lib/utils/file-download", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/utils/file-download")>()),
  saveBlobAsFile: vi.fn(),
}));

const SURVEY_ID = "clsurvey0000000000000001";

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const Wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  Wrapper.displayName = "UseExportSurveyTestWrapper";
  return Wrapper;
}

describe("useExportSurvey", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.mocked(saveBlobAsFile).mockReset();
  });

  test("saves the file under the name the server gave it once it answers 200", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response("{}", {
        status: 200,
        headers: {
          "Content-Disposition": `attachment; filename="NPS.formbricks.json"; filename*=UTF-8''NPS.formbricks.json`,
        },
      })
    );
    const { result } = renderHook(() => useExportSurvey(), { wrapper: createWrapper() });

    await act(() => result.current.mutateAsync({ surveyId: SURVEY_ID, format: "json" }));

    expect(saveBlobAsFile).toHaveBeenCalledWith(expect.any(Blob), "NPS.formbricks.json");
  });

  test("rejects with the problem and saves nothing when the server refuses", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ status: 429, code: "too_many_requests", detail: "Slow down" }), {
        status: 429,
        headers: { "Content-Type": "application/problem+json" },
      })
    );
    const { result } = renderHook(() => useExportSurvey(), { wrapper: createWrapper() });

    const error = await act(() =>
      result.current.mutateAsync({ surveyId: SURVEY_ID, format: "json" }).catch((caught: unknown) => caught)
    );

    expect(error).toBeInstanceOf(V3ApiError);
    expect(saveBlobAsFile).not.toHaveBeenCalled();
  });

  test("aborts the download in flight when the menu goes away, and saves nothing", async () => {
    let signal: AbortSignal | undefined;
    vi.mocked(global.fetch).mockImplementationOnce((_url, init) => {
      signal = init?.signal ?? undefined;
      return new Promise((_resolve, reject) =>
        signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")))
      );
    });
    const { result, unmount } = renderHook(() => useExportSurvey(), { wrapper: createWrapper() });

    act(() => result.current.mutate({ surveyId: SURVEY_ID, format: "json" }));
    await waitFor(() => expect(signal).toBeDefined());
    unmount();

    expect(signal?.aborted).toBe(true);
    expect(saveBlobAsFile).not.toHaveBeenCalled();
  });
});
