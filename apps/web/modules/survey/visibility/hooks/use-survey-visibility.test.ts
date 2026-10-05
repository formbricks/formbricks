/**
 * @vitest-environment jsdom
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { type ReactNode, createElement } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { surveyKeys } from "@/modules/survey/list/lib/query";
import { useSurveyVisibility } from "./use-survey-visibility";

function createWrapper(queryClient: QueryClient) {
  const Wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);

  Wrapper.displayName = "UseSurveyVisibilityTestWrapper";

  return Wrapper;
}

const visibilityState = {
  id: "survey_1",
  visibility: "workspace",
  owner: { name: "Ada" },
  access: { via: "workspace", canManageVisibility: true },
  blockers: [{ id: "wh_1", name: "Zapier", type: "webhook" }],
  impact: { memberCount: 4, responseCount: 12 },
  pending: null,
  version: 3,
  allowedTargets: [],
};

const newQueryClient = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });

describe("useSurveyVisibility", () => {
  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("loads the visibility sub-resource into its own cache entry", async () => {
    vi.mocked(global.fetch).mockResolvedValue(Response.json({ data: visibilityState }, { status: 200 }));
    const queryClient = newQueryClient();

    const { result } = renderHook(() => useSurveyVisibility({ surveyId: "survey_1" }), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(visibilityState);
    expect(queryClient.getQueryData(surveyKeys.visibility("survey_1"))).toEqual(visibilityState);
    expect(vi.mocked(global.fetch)).toHaveBeenCalledWith(
      "/api/v3/surveys/survey_1/visibility",
      expect.objectContaining({ method: "GET" })
    );
  });

  test("does not fetch while disabled", () => {
    const { result } = renderHook(() => useSurveyVisibility({ surveyId: "survey_1", enabled: false }), {
      wrapper: createWrapper(newQueryClient()),
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(vi.mocked(global.fetch)).not.toHaveBeenCalled();
  });

  test("surfaces a problem response as a V3ApiError", async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      Response.json(
        { status: 403, detail: "Survey visibility is not enabled", code: "visibility_not_enabled" },
        { status: 403 }
      )
    );

    const { result } = renderHook(() => useSurveyVisibility({ surveyId: "survey_1" }), {
      wrapper: createWrapper(newQueryClient()),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({ status: 403, code: "visibility_not_enabled" });
  });
});
