import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { jsonResponse as json, routeFetch } from "@/modules/api/lib/hook-test-utils";
import { V3ApiError } from "@/modules/api/lib/v3-client";
import {
  generateExampleResponses,
  generatePersonalLinks,
  getSurveyEmailEmbed,
  resetSurvey,
  saveSingleUseSettings,
  sendSurveyPreviewEmail,
} from "./api-client";

const SURVEY_ID = "clsurvey11111111111111111";
const SEGMENT_ID = "clsegment1111111111111111";
const BASE = `/api/internal/surveys/${SURVEY_ID}`;

const init = () => vi.mocked(global.fetch).mock.calls[0][1];
const sentBody = () => JSON.parse(String(init()?.body));

describe("survey summary API client", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("GETs the survey's email embed", async () => {
    const embed = { surveyId: SURVEY_ID, html: "<p>Survey</p>" };
    routeFetch({ [`GET ${BASE}/email-embed`]: [json({ data: embed })] });

    expect(await getSurveyEmailEmbed(SURVEY_ID)).toEqual(embed);
  });

  // An email send, an LLM generation and a large segment's CSV can each run long: no client timeout.
  test.each([
    ["the preview email", "preview-emails", () => sendSurveyPreviewEmail(SURVEY_ID), { emailSent: true }],
    [
      "the example responses",
      "example-responses",
      () => generateExampleResponses(SURVEY_ID),
      { surveyId: SURVEY_ID, createdCount: 20 },
    ],
  ])("POSTs %s with no timeout", async (_label, resource, call, data) => {
    routeFetch({ [`POST ${BASE}/${resource}`]: [json({ data })] });

    expect(await call()).toEqual(data);
    expect(init()?.signal).toBeUndefined();
  });

  test("POSTs a personal links request with no timeout, without the survey id in the body", async () => {
    const csv = { fileName: "personal-links.csv", csvContent: "a,b" };
    routeFetch({ [`POST ${BASE}/personal-links`]: [json({ data: csv })] });

    expect(
      await generatePersonalLinks({ surveyId: SURVEY_ID, segmentId: SEGMENT_ID, expirationDays: 3 })
    ).toEqual(csv);
    expect(sentBody()).toEqual({ segmentId: SEGMENT_ID, expirationDays: 3 });
    expect(init()?.signal).toBeUndefined();
  });

  test("POSTs a reset with the usual timeout", async () => {
    const counts = { surveyId: SURVEY_ID, deletedResponsesCount: 3, deletedDisplaysCount: 5 };
    routeFetch({ [`POST ${BASE}/resets`]: [json({ data: counts })] });

    expect(await resetSurvey(SURVEY_ID)).toEqual(counts);
    expect(init()?.signal).toBeInstanceOf(AbortSignal);
  });

  test("PUTs the single-use settings", async () => {
    const settings = { surveyId: SURVEY_ID, enabled: true, isEncrypted: false };
    routeFetch({ [`PUT ${BASE}/single-use-settings`]: [json({ data: settings })] });

    expect(await saveSingleUseSettings({ surveyId: SURVEY_ID, enabled: true, isEncrypted: false })).toEqual(
      settings
    );
    expect(sentBody()).toEqual({ enabled: true, isEncrypted: false });
  });

  test("surfaces the server's reason for a refusal", async () => {
    const detail = "Cannot reset an archived survey.";
    routeFetch({ [`POST ${BASE}/resets`]: [json({ status: 403, detail }, 403)] });

    const failure = resetSurvey(SURVEY_ID);
    await expect(failure).rejects.toBeInstanceOf(V3ApiError);
    await expect(failure).rejects.toMatchObject({ status: 403, detail });
  });
});
