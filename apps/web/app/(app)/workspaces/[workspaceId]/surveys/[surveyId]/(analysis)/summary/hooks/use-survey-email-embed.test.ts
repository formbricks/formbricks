/**
 * @vitest-environment jsdom
 */
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createQueryWrapper, jsonResponse as json, routeFetch } from "@/modules/api/lib/hook-test-utils";
import { surveyEmailEmbedKey, useSurveyEmailEmbed } from "./use-survey-email-embed";

const SURVEY_ID = "clsurvey11111111111111111";
const EMBED_URL = `/api/internal/surveys/${SURVEY_ID}/email-embed`;

describe("useSurveyEmailEmbed", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("reads the survey's email embed", async () => {
    routeFetch({ [`GET ${EMBED_URL}`]: [json({ data: { surveyId: SURVEY_ID, html: "<p>Survey</p>" } })] });
    const { wrapper } = createQueryWrapper();

    const { result } = renderHook(() => useSurveyEmailEmbed(SURVEY_ID), { wrapper });

    await waitFor(() => expect(result.current.data?.html).toBe("<p>Survey</p>"));
  });

  test("keeps nothing once the tab closes, so it renders afresh the next time", async () => {
    routeFetch({ [`GET ${EMBED_URL}`]: [json({ data: { surveyId: SURVEY_ID, html: "<p>Survey</p>" } })] });
    const { wrapper, queryClient } = createQueryWrapper();

    const { result, unmount } = renderHook(() => useSurveyEmailEmbed(SURVEY_ID), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    unmount();

    await waitFor(() => expect(queryClient.getQueryData(surveyEmailEmbedKey(SURVEY_ID))).toBeUndefined());
  });
});
