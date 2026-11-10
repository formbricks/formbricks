import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { jsonResponse as json, routeFetch } from "@/modules/api/lib/hook-test-utils";
import { V3ApiError } from "@/modules/api/lib/v3-client";
import { copySurvey, generateSingleUseLinks } from "./api-client";

const SURVEY_ID = "clsurvey11111111111111111";
const WORKSPACE_ID = "clwork1111111111111111111";
const BASE = `/api/internal/surveys/${SURVEY_ID}`;

const sentBody = () => JSON.parse(String(vi.mocked(global.fetch).mock.calls[0][1]?.body));

describe("survey list API client", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("POSTs a copy with its target workspace", async () => {
    const copy = {
      id: "clcopy1111111111111111111",
      workspaceId: WORKSPACE_ID,
      customCssNotice: "invalid_css",
    };
    routeFetch({ [`POST ${BASE}/copies`]: [json({ data: copy }, 201)] });

    expect(await copySurvey({ surveyId: SURVEY_ID, targetWorkspaceId: WORKSPACE_ID })).toEqual(copy);
    expect(sentBody()).toEqual({ targetWorkspaceId: WORKSPACE_ID });
  });

  test("POSTs a single-use link request without the survey id in the body", async () => {
    const links = [{ suId: "su1", suToken: "token" }];
    routeFetch({ [`POST ${BASE}/single-use-links`]: [json({ data: links })] });

    expect(await generateSingleUseLinks({ surveyId: SURVEY_ID, isEncrypted: true, count: 1 })).toEqual(links);
    expect(sentBody()).toEqual({ isEncrypted: true, count: 1 });
  });

  test("surfaces the server's reason for a refusal", async () => {
    const detail = "The target workspace has reached its survey limit";
    routeFetch({ [`POST ${BASE}/copies`]: [json({ status: 403, detail }, 403)] });

    const failure = copySurvey({ surveyId: SURVEY_ID, targetWorkspaceId: WORKSPACE_ID });
    await expect(failure).rejects.toBeInstanceOf(V3ApiError);
    await expect(failure).rejects.toMatchObject({ status: 403, detail });
  });
});
