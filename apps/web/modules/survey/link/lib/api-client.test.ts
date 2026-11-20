import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { jsonResponse as json, routeFetch } from "@/modules/api/lib/hook-test-utils";
import { V3ApiError } from "@/modules/api/lib/v3-client";
import { isLinkSurveyGoneApiError, sendLinkSurveyVerificationEmail, verifyLinkSurveyPin } from "./api-client";

const surveyId = "clsurvey00000000000000000";
const PIN_ROUTE = "POST /api/internal/link-survey-pin-verifications";
const EMAIL_ROUTE = "POST /api/internal/link-survey-verification-emails";

const problem = (status: number, extra: Record<string, unknown> = {}) =>
  json({ status, detail: `problem ${status}`, ...extra }, status);

const wireSurvey = {
  id: surveyId,
  pin: null,
  createdAt: "2026-01-02T03:04:05.000Z",
  updatedAt: "2026-02-02T03:04:05.000Z",
  visibilityChangedAt: null,
  publishOn: null,
  closeOn: "2026-12-31T00:00:00.000Z",
  archivedAt: null,
  languages: [
    {
      default: true,
      enabled: true,
      language: {
        id: "lang-1",
        code: "en",
        alias: null,
        workspaceId: "ws-1",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    },
  ],
  triggers: [
    {
      actionClass: {
        id: "ac-1",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-03T00:00:00.000Z",
      },
    },
  ],
  segment: { id: "seg-1", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-04T00:00:00.000Z" },
  followUps: [],
};

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("verifyLinkSurveyPin", () => {
  test("returns the survey with its timestamps as Dates, as the server action handed it over", async () => {
    routeFetch({ [PIN_ROUTE]: [json({ data: { survey: wireSurvey, pinAuthToken: "pin-token" } })] });

    const result = await verifyLinkSurveyPin({ surveyId, pin: "1234" });

    expect(result.pinAuthToken).toBe("pin-token");
    expect(result.survey.createdAt).toEqual(new Date("2026-01-02T03:04:05.000Z"));
    expect(result.survey.updatedAt).toEqual(new Date("2026-02-02T03:04:05.000Z"));
    expect(result.survey.closeOn).toEqual(new Date("2026-12-31T00:00:00.000Z"));
    expect(result.survey.publishOn).toBeNull();
    expect(result.survey.languages[0].language.createdAt).toBeInstanceOf(Date);
    expect(result.survey.triggers[0].actionClass.updatedAt).toEqual(new Date("2026-01-03T00:00:00.000Z"));
    expect(result.survey.segment?.updatedAt).toEqual(new Date("2026-01-04T00:00:00.000Z"));
  });

  test("sends the PIN and the single-use link it was opened with", async () => {
    routeFetch({ [PIN_ROUTE]: [json({ data: { survey: wireSurvey } })] });

    await verifyLinkSurveyPin({ surveyId, pin: "1234", suId: "invitee-1", suToken: "token" });

    const [, init] = vi.mocked(global.fetch).mock.calls[0];
    expect(JSON.parse(String(init?.body))).toEqual({
      surveyId,
      pin: "1234",
      suId: "invitee-1",
      suToken: "token",
    });
  });

  test("throws the wrong PIN as a V3ApiError carrying INVALID_PIN", async () => {
    routeFetch({
      [PIN_ROUTE]: [problem(422, { detail: "INVALID_PIN", details: { reason: "INVALID_PIN" } })],
    });

    await expect(verifyLinkSurveyPin({ surveyId, pin: "0000" })).rejects.toMatchObject({
      status: 422,
      detail: "INVALID_PIN",
    });
  });
});

describe("sendLinkSurveyVerificationEmail", () => {
  test("sends the email request with no client timeout: the email goes out before the answer", async () => {
    routeFetch({ [EMAIL_ROUTE]: [new Response(null, { status: 204 })] });
    const timeout = vi.spyOn(AbortSignal, "timeout");

    await sendLinkSurveyVerificationEmail({ surveyId, email: "a@example.com", locale: "en-US" });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(timeout).not.toHaveBeenCalled();
  });
});

describe("isLinkSurveyGoneApiError", () => {
  test("is true for the gates' not-found answer", async () => {
    routeFetch({ [EMAIL_ROUTE]: [problem(404, { code: "not_found" })] });

    const error = await sendLinkSurveyVerificationEmail({
      surveyId,
      email: "a@example.com",
      locale: "en-US",
    }).catch((thrown: unknown) => thrown);

    expect(isLinkSurveyGoneApiError(error)).toBe(true);
  });

  test.each([
    ["a wrong PIN", new V3ApiError({ status: 422, detail: "INVALID_PIN" })],
    ["a rate limit", new V3ApiError({ status: 429, detail: "Maximum number of requests reached." })],
    ["a network failure", new V3ApiError({ status: 0, detail: "" })],
    ["a plain error", new Error("boom")],
  ])("is false for %s", (_label, error) => {
    expect(isLinkSurveyGoneApiError(error)).toBe(false);
  });
});
