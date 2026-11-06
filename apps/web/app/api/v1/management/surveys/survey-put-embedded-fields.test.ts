import { beforeEach, describe, expect, test, vi } from "vitest";
import type { TSurveyBlock } from "@formbricks/types/surveys/blocks";
import {
  SURVEY_FLOW_FIXTURE_IDS,
  surveyFlowFixture,
} from "@formbricks/types/surveys/test-fixtures/survey-flow-fixture";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { can } from "@/lib/authorization";
import { getOrganizationByWorkspaceId } from "@/lib/organization/service";
import { getSurvey, updateSurvey } from "@/lib/survey/service";
import { getExternalUrlsPermission } from "@/modules/survey/lib/permission";
import { PUT } from "./[surveyId]/route";

/**
 * The v1 PUT and the typed Embedded Data it cannot carry (ENG-6935). A computed date is declared only
 * in the survey's rows, never in the legacy `variables`, so the PUT validates the survey's logic
 * against its stored rows, while still never handing `updateSurvey` an `embeddedFields` to write.
 *
 * `withV1ApiWrapper` is reduced to its handler, as in `survey-put-codes.test.ts`.
 */
vi.mock("@/lib/authzed/scope-readiness", () => ({ isSurveyVisibilityReady: vi.fn(async () => false) }));
vi.mock("@/app/lib/api/with-api-logging", () => ({
  withV1ApiWrapper: ({ handler }: { handler: unknown }) => handler,
}));
vi.mock("@/lib/authorization", () => ({ can: vi.fn() }));
vi.mock("@/lib/organization/service", () => ({ getOrganizationByWorkspaceId: vi.fn() }));
vi.mock("@/lib/survey/service", () => ({
  createSurvey: vi.fn(),
  getSurvey: vi.fn(),
  updateSurvey: vi.fn(),
}));
vi.mock("@/app/api/v1/management/lib/workspace-resolver", () => ({ resolveBodyIds: vi.fn() }));
vi.mock("@/modules/ee/license-check/lib/utils", () => ({ getIsSpamProtectionEnabled: vi.fn() }));
vi.mock("@/modules/survey/follow-ups/lib/utils", () => ({ getSurveyFollowUpsPermission: vi.fn() }));
vi.mock("@/modules/survey/lib/permission", () => ({ getExternalUrlsPermission: vi.fn() }));
vi.mock("@/app/api/v1/management/surveys/lib/surveys", () => ({ getSurveys: vi.fn() }));
vi.mock("@/app/api/v1/management/surveys/[surveyId]/lib/surveys", () => ({ deleteSurvey: vi.fn() }));
vi.mock("@/app/lib/api/legacy-environment-id", () => ({
  addLegacyEnvironmentId: vi.fn(async (value) => value),
  addLegacyEnvironmentIdBestEffort: vi.fn(async (value) => value),
  addLegacyEnvironmentIdToList: vi.fn(async (value) => value),
}));
vi.mock("@/modules/storage/utils", () => ({ resolveStorageUrlsInObject: vi.fn((value) => value) }));

const ids = SURVEY_FLOW_FIXTURE_IDS;
const apiKey = { apiKeyId: "key_1", workspacePermissions: [], organizationId: "org_1" };

const put = (body: Record<string, unknown>) =>
  (PUT as unknown as (args: object) => Promise<{ response: Response }>)({
    req: new Request(`http://localhost/api/v1/management/surveys/${surveyFlowFixture.id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
    props: { params: Promise.resolve({ surveyId: surveyFlowFixture.id }) },
    authentication: apiKey,
  });

/** The fixture's blocks with the computed date step's target replaced. */
const blocksSetting = (variableId: string): TSurveyBlock[] =>
  structuredClone(surveyFlowFixture.blocks).map((block) => ({
    ...block,
    logic: block.logic?.map((rule) => ({
      ...rule,
      actions: rule.actions.map((action) =>
        action.objective === "calculate" && action.variableId === ids.variables.signedUpAt
          ? { ...action, variableId }
          : action
      ),
    })),
  }));

beforeEach(() => {
  vi.mocked(can).mockResolvedValue(true);
  vi.mocked(getExternalUrlsPermission).mockResolvedValue(true);
  vi.mocked(getSurvey).mockResolvedValue(surveyFlowFixture);
  vi.mocked(updateSurvey).mockReset();
  vi.mocked(updateSurvey).mockImplementation(async (survey) => survey as TSurvey);
  vi.mocked(getOrganizationByWorkspaceId).mockResolvedValue({ id: "org_1" } as never);
});

describe("PUT /api/v1/management/surveys/[surveyId] with a computed date", () => {
  test("validates logic that sets a computed date against the stored rows, and never writes them", async () => {
    // The stored survey's legacy variables don't hold the date its Set value step sets.
    expect(surveyFlowFixture.variables.map((variable) => variable.id)).not.toContain(
      ids.variables.signedUpAt
    );

    const { response } = await put({ name: "Renamed" });

    expect(response.status).toBe(200);
    const sent = vi.mocked(updateSurvey).mock.calls[0][0];
    expect(sent.name).toBe("Renamed");
    expect(sent).not.toHaveProperty("embeddedFields");
  });

  test("a body's own embeddedFields neither validates nor writes anything", async () => {
    const { response } = await put({ name: "Renamed", embeddedFields: [] });

    expect(response.status).toBe(200);
    expect(vi.mocked(updateSurvey).mock.calls[0][0]).not.toHaveProperty("embeddedFields");
  });

  test("a reference to a computed field the survey doesn't have is still a 400", async () => {
    const { response } = await put({ blocks: blocksSetting("clmissingvariable000000001") });

    expect(response.status).toBe(400);
    expect(JSON.stringify(await response.json())).toContain(
      "Variable ID clmissingvariable000000001 does not exist"
    );
    expect(updateSurvey).not.toHaveBeenCalled();
  });
});
