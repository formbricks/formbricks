import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { TSurveyQuotaInput } from "@formbricks/types/quota";
import { jsonResponse as json, routeFetch } from "@/modules/api/lib/hook-test-utils";
import { V3ApiError } from "@/modules/api/lib/v3-client";
import { createQuota, deleteQuota, getQuotaResponseCount, updateQuota } from "./api-client";

const QUOTA_ID = "clquota111111111111111111";
const BASE = "/api/internal/quotas";

const quota: TSurveyQuotaInput = {
  surveyId: "clsurvey11111111111111111",
  name: "Under 30",
  limit: 50,
  logic: { connector: "and", conditions: [] },
  action: "continueSurvey",
  endingCardId: null,
  countPartialSubmissions: false,
};

const sentBody = () => JSON.parse(String(vi.mocked(global.fetch).mock.calls[0][1]?.body));

describe("quotas API client", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("POSTs a new quota as the body", async () => {
    routeFetch({ [`POST ${BASE}`]: [json({ data: { id: QUOTA_ID, ...quota } }, 201)] });

    expect(await createQuota(quota)).toEqual({ id: QUOTA_ID, ...quota });
    expect(sentBody()).toEqual(quota);
  });

  test("PUTs a quota's settings to its own path", async () => {
    routeFetch({ [`PUT ${BASE}/${QUOTA_ID}`]: [json({ data: { id: QUOTA_ID, ...quota } })] });

    await updateQuota(QUOTA_ID, quota);
    expect(sentBody()).toEqual(quota);
  });

  test("DELETEs a quota", async () => {
    routeFetch({ [`DELETE ${BASE}/${QUOTA_ID}`]: [new Response(null, { status: 204 })] });
    await expect(deleteQuota(QUOTA_ID)).resolves.toBeUndefined();
  });

  test("reads the screened-in count", async () => {
    routeFetch({
      [`GET ${BASE}/${QUOTA_ID}/response-count`]: [json({ data: { quotaId: QUOTA_ID, count: 7 } })],
    });
    expect(await getQuotaResponseCount(QUOTA_ID)).toEqual({ quotaId: QUOTA_ID, count: 7 });
  });

  test("surfaces a taken name as the server's message", async () => {
    const detail = "Quota with this name already exists";
    routeFetch({ [`POST ${BASE}`]: [json({ status: 409, detail }, 409)] });

    const failure = createQuota(quota);
    await expect(failure).rejects.toBeInstanceOf(V3ApiError);
    await expect(failure).rejects.toMatchObject({ status: 409, detail });
  });
});
