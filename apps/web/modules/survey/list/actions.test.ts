import { revalidatePath } from "next/cache";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { OperationNotAllowedError } from "@formbricks/types/errors";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import { getOrganizationIdFromSurveyId, getWorkspaceIdFromSurveyId } from "@/lib/utils/helper";
import { updateSurvey } from "@/modules/survey/editor/lib/survey";
import { getSurvey } from "@/modules/survey/lib/survey";
import { updateSurveyStatusAction } from "./actions";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/utils/action-client", () => ({
  authenticatedActionClient: {
    inputSchema: vi.fn(() => ({
      action: vi.fn((fn) => fn),
    })),
  },
}));

vi.mock("@/lib/utils/action-client/action-client-middleware", () => ({
  checkAuthorizationUpdated: vi.fn(),
}));

vi.mock("@/lib/utils/helper", () => ({
  getOrganizationIdFromSurveyId: vi.fn(),
  getOrganizationIdFromWorkspaceId: vi.fn(),
  getWorkspaceIdFromSurveyId: vi.fn(),
}));

vi.mock("@/lib/utils/single-use-surveys", () => ({
  generateSurveySingleUseLinkParams: vi.fn(),
  generateSurveySingleUseLinkParamsList: vi.fn(),
}));

vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({
  withAuditLogging: vi.fn((_eventName, _targetType, fn) => fn),
}));

vi.mock("@/modules/survey/editor/lib/survey", () => ({
  updateSurvey: vi.fn(),
}));

vi.mock("@/modules/survey/lib/survey", () => ({
  getSurvey: vi.fn(),
}));

vi.mock("@/modules/survey/list/lib/survey", () => ({
  copySurveyToOtherWorkspace: vi.fn(),
}));

const baseSurvey = {
  id: "survey_1",
  workspaceId: "workspace_1",
  status: "inProgress",
};

const ctx = {
  user: { id: "user_1" },
  auditLoggingCtx: {},
};

describe("updateSurveyStatusAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getOrganizationIdFromSurveyId).mockResolvedValue("organization_1");
    vi.mocked(getWorkspaceIdFromSurveyId).mockResolvedValue("workspace_1");
    vi.mocked(checkAuthorizationUpdated).mockResolvedValue(undefined);
    vi.mocked(getSurvey).mockResolvedValue(baseSurvey as never);
    vi.mocked(updateSurvey).mockResolvedValue({ ...baseSurvey, status: "completed" } as never);
  });

  test("updates a non-draft survey status with read-write access", async () => {
    const result = await updateSurveyStatusAction({
      ctx,
      parsedInput: { surveyId: "survey_1", status: "completed" },
    } as never);

    expect(checkAuthorizationUpdated).toHaveBeenCalledWith({
      userId: "user_1",
      organizationId: "organization_1",
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
        {
          type: "workspaceTeam",
          workspaceId: "workspace_1",
          minPermission: "readWrite",
        },
      ],
    });
    expect(updateSurvey).toHaveBeenCalledWith({ ...baseSurvey, status: "completed" });
    expect(ctx.auditLoggingCtx).toEqual({
      organizationId: "organization_1",
      surveyId: "survey_1",
      oldObject: baseSurvey,
      newObject: { ...baseSurvey, status: "completed" },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/workspaces/workspace_1/surveys");
    expect(revalidatePath).toHaveBeenCalledWith("/workspaces/workspace_1/surveys/survey_1");
    expect(result).toEqual({ ...baseSurvey, status: "completed" });
  });

  test("rejects draft survey status changes from the list", async () => {
    vi.mocked(getSurvey).mockResolvedValue({ ...baseSurvey, status: "draft" } as never);

    await expect(
      updateSurveyStatusAction({
        ctx: { user: { id: "user_1" }, auditLoggingCtx: {} },
        parsedInput: { surveyId: "survey_1", status: "completed" },
      } as never)
    ).rejects.toThrow(OperationNotAllowedError);
    expect(updateSurvey).not.toHaveBeenCalled();
  });
});
