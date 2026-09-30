import { beforeEach, describe, expect, test, vi } from "vitest";
import { OperationNotAllowedError } from "@formbricks/types/errors";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { can } from "@/lib/authorization";
import { getOrganizationIdFromSurveyId, getWorkspaceIdFromSurveyId } from "@/lib/utils/helper";
import { updateSurvey, updateSurveyDraft } from "@/modules/survey/editor/lib/survey";
import { getSurvey } from "@/modules/survey/lib/survey";
import { updateSurveyAction, updateSurveyDraftAction } from "./actions";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/utils/action-client", () => ({
  authenticatedActionClient: {
    inputSchema: vi.fn().mockReturnThis(),
    action: vi.fn((fn) => fn),
  },
}));

vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({
  withAuditLogging: vi.fn((_action, _target, fn) => fn),
}));

vi.mock("@/lib/authorization", () => ({
  assertCan: vi.fn(),
  can: vi.fn(),
}));

vi.mock("@/lib/constants", () => ({
  IS_FORMBRICKS_SURVEYS_CONFIGURED: false,
  POSTHOG_KEY: undefined,
  UNSPLASH_ACCESS_KEY: undefined,
  UNSPLASH_ALLOWED_DOMAINS: [],
}));

vi.mock("@/lib/posthog", () => ({ capturePostHogEvent: vi.fn() }));

vi.mock("@/lib/utils/helper", () => ({
  getOrganizationIdFromSurveyId: vi.fn(),
  getOrganizationIdFromWorkspaceId: vi.fn(),
  getWorkspaceIdFromSurveyId: vi.fn(),
}));

vi.mock("@/modules/core/rate-limit/helpers", () => ({ applyRateLimit: vi.fn() }));
vi.mock("@/modules/core/rate-limit/rate-limit-configs", () => ({
  rateLimitConfigs: { actions: { stateMutation: {} } },
}));
vi.mock("@/modules/survey/editor/lib/action-class", () => ({ createActionClass: vi.fn() }));
vi.mock("@/modules/survey/editor/lib/check-external-urls-permission", () => ({
  checkExternalUrlsPermission: vi.fn(),
}));
vi.mock("@/modules/survey/editor/lib/survey", () => ({
  updateSurvey: vi.fn(),
  updateSurveyDraft: vi.fn(),
}));
vi.mock("@/modules/survey/follow-ups/lib/utils", () => ({ getSurveyFollowUpsPermission: vi.fn() }));
vi.mock("@/modules/survey/lib/permission", () => ({ checkSpamProtectionPermission: vi.fn() }));
vi.mock("@/modules/survey/lib/survey", () => ({
  getOrganizationBilling: vi.fn(),
  getSurvey: vi.fn(),
}));
vi.mock("@/modules/survey/list/lib/survey", () => ({ getSurveyCount: vi.fn() }));
vi.mock("./lib/workspace", () => ({ getWorkspace: vi.fn(), getWorkspaceLanguages: vi.fn() }));

const storedSurvey = {
  id: "survey_1",
  workspaceId: "ws_1",
  status: "inProgress",
  type: "link",
  blocks: [],
  endings: [],
  followUps: [],
  hiddenFields: { enabled: false, fieldIds: [] },
  customHeadScripts: null,
  customHeadScriptsMode: null,
} as unknown as TSurvey;

const script = "<script>analytics()</script>";

// A Read & write member: `workspace.write` passes (the mocked `assertCan`), `workspace.manage` does not.
const actAsReadWriteMember = () =>
  vi.mocked(can).mockImplementation(async (_actor, action) => action !== "workspace.manage");

const run = (action: typeof updateSurveyAction | typeof updateSurveyDraftAction, survey: TSurvey) =>
  (action as unknown as (args: object) => Promise<unknown>)({
    ctx: { user: { id: "user_1" }, auditLoggingCtx: {} },
    parsedInput: survey,
  });

describe.each([
  ["updateSurveyAction", updateSurveyAction, updateSurvey],
  ["updateSurveyDraftAction", updateSurveyDraftAction, updateSurveyDraft],
] as const)("%s custom head scripts", (_name, action, write) => {
  beforeEach(() => {
    vi.mocked(can).mockReset();
    vi.mocked(write).mockReset();
    vi.mocked(getOrganizationIdFromSurveyId).mockResolvedValue("org_1");
    vi.mocked(getWorkspaceIdFromSurveyId).mockResolvedValue("ws_1");
    vi.mocked(getSurvey).mockResolvedValue(storedSurvey);
    vi.mocked(write).mockImplementation(async (survey) => survey);
  });

  test("refuses a Read & write member who sets survey head scripts", async () => {
    actAsReadWriteMember();

    await expect(run(action, { ...storedSurvey, customHeadScripts: script })).rejects.toThrow(
      OperationNotAllowedError
    );
    expect(write).not.toHaveBeenCalled();
  });

  test("refuses a Read & write member who switches the scripts to replace the workspace's", async () => {
    actAsReadWriteMember();

    await expect(run(action, { ...storedSurvey, customHeadScriptsMode: "replace" })).rejects.toThrow(
      OperationNotAllowedError
    );
    expect(write).not.toHaveBeenCalled();
  });

  test("lets a Read & write member save a survey whose scripts a manager already set", async () => {
    const surveyWithScripts = { ...storedSurvey, customHeadScripts: script, customHeadScriptsMode: "add" };
    vi.mocked(getSurvey).mockResolvedValue(surveyWithScripts as TSurvey);
    actAsReadWriteMember();

    await run(action, { ...surveyWithScripts, name: "Renamed" } as TSurvey);

    expect(write).toHaveBeenCalled();
  });

  test("lets a member with Manage access set survey head scripts", async () => {
    vi.mocked(can).mockResolvedValue(true);

    await run(action, { ...storedSurvey, customHeadScripts: script });

    expect(can).toHaveBeenCalledWith({ type: "user", id: "user_1" }, "workspace.manage", {
      type: "workspace",
      id: "ws_1",
    });
    expect(write).toHaveBeenCalledWith(expect.objectContaining({ customHeadScripts: script }));
  });
});
