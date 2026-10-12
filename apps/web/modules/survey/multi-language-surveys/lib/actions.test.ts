import { beforeEach, describe, expect, test, vi } from "vitest";
import { deleteLanguage, getSurveysUsingGivenLanguage } from "@/lib/language/service";
import { getUserVisibleSurveyWhere } from "@/lib/survey/visibility/actor-context";
import { getOrganizationIdFromWorkspaceId, getWorkspaceIdFromLanguageId } from "@/lib/utils/helper";
import { deleteLanguageAction, getSurveysUsingGivenLanguageAction } from "./actions";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/utils/action-client", () => ({
  authenticatedActionClient: { inputSchema: vi.fn().mockReturnThis(), action: vi.fn((fn) => fn) },
}));
vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({
  withAuditLogging: vi.fn((_action, _target, fn) => fn),
}));
vi.mock("@/lib/authorization", () => ({ assertCan: vi.fn() }));
vi.mock("@/lib/posthog", () => ({ capturePostHogEvent: vi.fn() }));
vi.mock("@/lib/language/service", () => ({
  createLanguage: vi.fn(),
  deleteLanguage: vi.fn(),
  getLanguage: vi.fn(),
  getSurveysUsingGivenLanguage: vi.fn(),
  updateLanguage: vi.fn(),
}));
vi.mock("@/lib/survey/visibility/actor-context", () => ({ getUserVisibleSurveyWhere: vi.fn() }));
vi.mock("@/lib/utils/helper", () => ({
  getOrganizationIdFromWorkspaceId: vi.fn(),
  getWorkspaceIdFromLanguageId: vi.fn(),
}));
vi.mock("@/modules/core/rate-limit/helpers", () => ({ applyRateLimit: vi.fn() }));
vi.mock("@/modules/core/rate-limit/rate-limit-configs", () => ({
  rateLimitConfigs: { actions: { stateMutation: {} } },
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getWorkspaceIdFromLanguageId).mockResolvedValue("ws_1");
  vi.mocked(getOrganizationIdFromWorkspaceId).mockResolvedValue("org_1");
});

describe("getSurveysUsingGivenLanguageAction (ENG-3282)", () => {
  test("names only the surveys this caller may see", async () => {
    const visibleSurveyWhere = { OR: [{ visibility: "workspace" as const }, { ownerId: "user_1" }] };
    vi.mocked(getUserVisibleSurveyWhere).mockResolvedValue(visibleSurveyWhere);
    vi.mocked(getSurveysUsingGivenLanguage).mockResolvedValue(["Visible survey"]);

    const result = await (
      getSurveysUsingGivenLanguageAction as unknown as (args: object) => Promise<unknown>
    )({
      ctx: { user: { id: "user_1" } },
      parsedInput: { languageId: "lang_1" },
    });

    expect(result).toEqual(["Visible survey"]);
    expect(getUserVisibleSurveyWhere).toHaveBeenCalledWith("user_1", "org_1");
    expect(getSurveysUsingGivenLanguage).toHaveBeenCalledWith("lang_1", visibleSurveyWhere);
  });
});

describe("deleteLanguageAction (ENG-3282)", () => {
  test("passes the caller's visibility clause, so an in-use refusal names only surveys they see", async () => {
    const visibleSurveyWhere = { OR: [{ visibility: "workspace" as const }, { ownerId: "user_1" }] };
    vi.mocked(getUserVisibleSurveyWhere).mockResolvedValue(visibleSurveyWhere);
    vi.mocked(deleteLanguage).mockResolvedValue({ id: "lang_1" } as Awaited<
      ReturnType<typeof deleteLanguage>
    >);

    await (deleteLanguageAction as unknown as (args: object) => Promise<unknown>)({
      ctx: { user: { id: "user_1" }, auditLoggingCtx: {} },
      parsedInput: { languageId: "lang_1", workspaceId: "ws_1" },
    });

    expect(getUserVisibleSurveyWhere).toHaveBeenCalledWith("user_1", "org_1");
    expect(deleteLanguage).toHaveBeenCalledWith("lang_1", "ws_1", visibleSurveyWhere);
  });
});
