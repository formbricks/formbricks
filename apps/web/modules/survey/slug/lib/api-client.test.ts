import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { jsonResponse as json, routeFetch } from "@/modules/api/lib/hook-test-utils";
import { V3ApiError, getV3ApiErrorMessage } from "@/modules/api/lib/v3-client";
import { removeSurveySlug, updateSurveySlug } from "./api-client";

const SURVEY_ID = "clsurvey11111111111111111";
const URL = `/api/internal/surveys/${SURVEY_ID}/slug`;
const SAVED_AT = "2026-11-12T10:00:00.000Z";

describe("survey slug API client", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("PUTs the slug", async () => {
    routeFetch({
      [`PUT ${URL}`]: [json({ data: { surveyId: SURVEY_ID, slug: "summer", updatedAt: SAVED_AT } })],
    });

    expect(await updateSurveySlug(SURVEY_ID, "summer")).toEqual({
      surveyId: SURVEY_ID,
      slug: "summer",
      updatedAt: new Date(SAVED_AT),
    });
    expect(JSON.parse(String(vi.mocked(global.fetch).mock.calls[0][1]?.body))).toEqual({ slug: "summer" });
  });

  test("DELETEs the slug", async () => {
    routeFetch({
      [`DELETE ${URL}`]: [json({ data: { surveyId: SURVEY_ID, slug: null, updatedAt: SAVED_AT } })],
    });
    await expect(removeSurveySlug(SURVEY_ID)).resolves.toEqual({
      surveyId: SURVEY_ID,
      slug: null,
      updatedAt: new Date(SAVED_AT),
    });
  });

  test("surfaces a taken slug as the server's message", async () => {
    const detail = "A survey with this slug already exists";
    routeFetch({ [`PUT ${URL}`]: [json({ status: 409, detail }, 409)] });

    const failure = updateSurveySlug(SURVEY_ID, "taken");
    await expect(failure).rejects.toBeInstanceOf(V3ApiError);
    await expect(failure).rejects.toMatchObject({ status: 409, detail });
  });

  test("shows the slug rule from a 400, as the form showed the action's validation error", async () => {
    const reason = "Slug can only contain lowercase letters, numbers, and hyphens";
    routeFetch({
      [`PUT ${URL}`]: [
        json(
          { status: 400, detail: "Invalid request body", invalid_params: [{ name: "slug", reason }] },
          400
        ),
      ],
    });

    const error = await updateSurveySlug(SURVEY_ID, "Summer").catch((caught: unknown) => caught);
    expect(getV3ApiErrorMessage(error, "fallback")).toBe(reason);
  });
});
