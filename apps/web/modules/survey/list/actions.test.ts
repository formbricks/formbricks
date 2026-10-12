import { beforeEach, describe, expect, test, vi } from "vitest";
import { AuthorizationError } from "@formbricks/types/errors";
import { assertCan } from "@/lib/authorization";
import { getOrganizationIdFromWorkspaceId, getWorkspaceIdFromSurveyId } from "@/lib/utils/helper";
import { generateSurveySingleUseLinkParamsList } from "@/lib/utils/single-use-surveys";
import { copySurveyToOtherWorkspace } from "@/modules/survey/list/lib/survey";
import { copySurveyToOtherWorkspaceAction, generateSingleUseIdsAction } from "./actions";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/utils/action-client", () => ({
  authenticatedActionClient: { inputSchema: vi.fn().mockReturnThis(), action: vi.fn((fn) => fn) },
}));
vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({
  withAuditLogging: vi.fn((_action, _target, fn) => fn),
}));
vi.mock("@/lib/authorization", () => ({ assertCan: vi.fn() }));
vi.mock("@/lib/utils/helper", () => ({
  getOrganizationIdFromWorkspaceId: vi.fn(),
  getWorkspaceIdFromSurveyId: vi.fn(),
}));
vi.mock("@/lib/utils/single-use-surveys", () => ({
  generateSurveySingleUseLinkParams: vi.fn(),
  generateSurveySingleUseLinkParamsList: vi.fn(),
}));
vi.mock("@/modules/core/rate-limit/helpers", () => ({ applyRateLimit: vi.fn() }));
vi.mock("@/modules/core/rate-limit/rate-limit-configs", () => ({
  rateLimitConfigs: { actions: { stateMutation: {} } },
}));
vi.mock("@/modules/survey/list/lib/survey", () => ({ copySurveyToOtherWorkspace: vi.fn() }));

const user = { type: "user", id: "user_1" } as const;
const ctx = { user: { id: "user_1" }, auditLoggingCtx: {} };

type THandler = (args: object) => Promise<unknown>;

/** Every workspace check passes; the survey-level one answers `surveyAllowed`. */
const actAs = (surveyAllowed: boolean) =>
  vi.mocked(assertCan).mockImplementation(async (_actor, _action, resource) => {
    if (resource.type === "survey" && !surveyAllowed) throw new AuthorizationError("Not authorized");
  });

beforeEach(() => {
  vi.clearAllMocks();
  ctx.auditLoggingCtx = {};
  vi.mocked(getWorkspaceIdFromSurveyId).mockResolvedValue("ws_source");
  vi.mocked(getOrganizationIdFromWorkspaceId).mockResolvedValue("org_1");
  vi.mocked(copySurveyToOtherWorkspace).mockResolvedValue({ id: "survey_copy" } as never);
  vi.mocked(generateSurveySingleUseLinkParamsList).mockReturnValue([]);
});

describe("copySurveyToOtherWorkspaceAction (ENG-3282)", () => {
  const copy = () =>
    (copySurveyToOtherWorkspaceAction as unknown as THandler)({
      ctx,
      parsedInput: { surveyId: "survey_1", targetWorkspaceId: "ws_target" },
    });

  test("refuses a workspace writer who cannot read the source survey, copying nothing", async () => {
    actAs(false);

    await expect(copy()).rejects.toBeInstanceOf(AuthorizationError);
    expect(assertCan).toHaveBeenCalledWith(user, "survey.read", { type: "survey", id: "survey_1" });
    expect(copySurveyToOtherWorkspace).not.toHaveBeenCalled();
  });

  test("copies a survey the caller can read", async () => {
    actAs(true);

    await expect(copy()).resolves.toEqual({ id: "survey_copy" });
    expect(copySurveyToOtherWorkspace).toHaveBeenCalledWith("ws_source", "survey_1", "ws_target", "user_1");
  });
});

describe("generateSingleUseIdsAction (ENG-3282)", () => {
  const generate = () =>
    (generateSingleUseIdsAction as unknown as THandler)({
      ctx,
      parsedInput: { surveyId: "survey_1", isEncrypted: false, count: 2 },
    });

  test("mints no links for a survey the caller cannot write", async () => {
    actAs(false);

    await expect(generate()).rejects.toBeInstanceOf(AuthorizationError);
    expect(assertCan).toHaveBeenCalledWith(user, "survey.write", { type: "survey", id: "survey_1" });
    expect(generateSurveySingleUseLinkParamsList).not.toHaveBeenCalled();
  });

  test("mints links for a survey the caller can write", async () => {
    actAs(true);

    await generate();
    expect(generateSurveySingleUseLinkParamsList).toHaveBeenCalledWith(2, "survey_1", false);
  });
});
