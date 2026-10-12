import { beforeEach, describe, expect, test, vi } from "vitest";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { can } from "@/lib/authorization";
import { isSurveyVisibilityReady } from "@/lib/authzed/scope-readiness";
import { getSurvey } from "@/lib/survey/service";
import { generateSurveySingleUseLinkParamsList } from "@/lib/utils/single-use-surveys";
import { GET } from "./route";

/**
 * `withV1ApiWrapper` is reduced to its handler. The real `canApiKeyReachSurveyResource` runs over a
 * stubbed readiness marker and `can` (ENG-3282): minting single-use links writes into the survey.
 */
vi.mock("@/app/lib/api/with-api-logging", () => ({
  withV1ApiWrapper: ({ handler }: { handler: unknown }) => handler,
}));
vi.mock("@/app/api/v1/auth", () => ({ handleErrorResponse: vi.fn() }));
vi.mock("@/lib/authorization", () => ({ can: vi.fn() }));
vi.mock("@/lib/authzed/scope-readiness", () => ({ isSurveyVisibilityReady: vi.fn() }));
vi.mock("@/lib/survey/service", () => ({ getSurvey: vi.fn() }));
vi.mock("@/lib/getPublicUrl", () => ({ getPublicDomain: () => "https://forms.example.com" }));
vi.mock("@/lib/utils/single-use-surveys", () => ({ generateSurveySingleUseLinkParamsList: vi.fn() }));

const surveyId = "clxsurvey0000000000000001";
const survey = {
  id: surveyId,
  workspaceId: "clxworkspace00000000000001",
  type: "link",
  singleUse: { enabled: true, isEncrypted: false },
} as unknown as TSurvey;

const get = () => {
  const url = `http://localhost/api/v1/management/surveys/${surveyId}/singleUseIds?limit=1`;
  return (GET as unknown as (args: object) => Promise<{ response: Response }>)({
    req: Object.assign(new Request(url), { nextUrl: new URL(url) }),
    props: { params: Promise.resolve({ surveyId }) },
    authentication: { apiKeyId: "key_1", workspacePermissions: [], organizationId: "org_1" },
  });
};

/** A key with every workspace permission, whose survey-level answer is `surveyAllowed`. */
const actAsKey = (surveyAllowed: boolean) =>
  vi
    .mocked(can)
    .mockImplementation(async (_actor, _action, resource) =>
      resource.type === "survey" ? surveyAllowed : true
    );

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(isSurveyVisibilityReady).mockResolvedValue(true);
  vi.mocked(getSurvey).mockResolvedValue(survey);
  vi.mocked(generateSurveySingleUseLinkParamsList).mockReturnValue([{ suId: "su_1", suToken: "token_1" }]);
});

describe("GET /api/v1/management/surveys/[surveyId]/singleUseIds survey visibility", () => {
  test("mints no links for a survey the key cannot write", async () => {
    actAsKey(false);

    const { response } = await get();

    expect(response.status).toBe(401);
    expect(generateSurveySingleUseLinkParamsList).not.toHaveBeenCalled();
    expect(can).toHaveBeenCalledWith({ type: "apiKey", id: "key_1" }, "survey.write", {
      type: "survey",
      id: surveyId,
    });
  });

  test("mints links when the key can write the survey", async () => {
    actAsKey(true);

    const { response } = await get();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      data: [`https://forms.example.com/s/${surveyId}?suId=su_1&suToken=token_1`],
    });
  });
});
