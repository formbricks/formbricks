/**
 * @vitest-environment jsdom
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { type ReactNode, createElement } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createQueryWrapper, jsonResponse as json, routeFetch } from "@/modules/api/lib/hook-test-utils";
import { aiTranslationKeys } from "../lib/query";
import { useAITranslationAvailability } from "./use-ai-translation-availability";

const SURVEY_ID = "clsurv1111111111111111111";
const AVAILABILITY_URL = `/api/internal/ai-translations/availability?surveyId=${SURVEY_ID}`;

describe("useAITranslationAvailability", () => {
  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("reads unavailable until the check answers", () => {
    routeFetch({ [`GET ${AVAILABILITY_URL}`]: [json({ data: { available: true } })] });
    const { wrapper } = createQueryWrapper();

    const { result } = renderHook(() => useAITranslationAvailability(SURVEY_ID), { wrapper });

    expect(result.current).toEqual({ isAIAvailable: false, aiUnavailableReason: undefined });
  });

  test("reads available once the server says so", async () => {
    routeFetch({ [`GET ${AVAILABILITY_URL}`]: [json({ data: { available: true } })] });
    const { wrapper } = createQueryWrapper();

    const { result } = renderHook(() => useAITranslationAvailability(SURVEY_ID), { wrapper });

    await waitFor(() => expect(result.current.isAIAvailable).toBe(true));
    expect(result.current.aiUnavailableReason).toBeUndefined();
  });

  test("passes the reason on when AI is unavailable", async () => {
    routeFetch({
      [`GET ${AVAILABILITY_URL}`]: [json({ data: { available: false, reason: "not_in_plan" } })],
    });
    const { wrapper } = createQueryWrapper();

    const { result } = renderHook(() => useAITranslationAvailability(SURVEY_ID), { wrapper });

    await waitFor(() => expect(result.current.aiUnavailableReason).toBe("not_in_plan"));
    expect(result.current.isAIAvailable).toBe(false);
  });

  test("a refused check reads as unavailable, and is not retried under the editor's retry-everything client", async () => {
    routeFetch({
      [`GET ${AVAILABILITY_URL}`]: [json({ status: 403, detail: "Forbidden", code: "forbidden" }, 403)],
    });
    const queryClient = new QueryClient();
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children);

    const { result } = renderHook(() => useAITranslationAvailability(SURVEY_ID), { wrapper });

    await waitFor(() =>
      expect(queryClient.getQueryState(aiTranslationKeys.availability(SURVEY_ID))?.status).toBe("error")
    );
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(result.current).toEqual({ isAIAvailable: false, aiUnavailableReason: undefined });
    queryClient.clear();
  });
});
