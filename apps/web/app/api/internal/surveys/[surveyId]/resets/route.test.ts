import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { SAME_ORIGIN_HEADERS } from "@/app/api/v3/lib/test-utils";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  can: vi.fn(),
  getSession: vi.fn(),
  queueAuditEvent: vi.fn(),
  getSurvey: vi.fn(),
  getOrganizationIdFromSurveyId: vi.fn(),
  deleteResponsesAndDisplaysForSurvey: vi.fn(),
}));

vi.mock("@/lib/authorization", () => ({ can: mocks.can }));
vi.mock("@/lib/survey/service", () => ({ getSurvey: mocks.getSurvey }));
vi.mock("@/lib/utils/helper", () => ({ getOrganizationIdFromSurveyId: mocks.getOrganizationIdFromSurveyId }));
vi.mock("@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/(analysis)/summary/lib/survey", () => ({
  deleteResponsesAndDisplaysForSurvey: mocks.deleteResponsesAndDisplaysForSurvey,
}));
vi.mock("@/modules/auth/lib/session", () => ({ getSession: mocks.getSession }));
vi.mock("@/app/api/v1/auth", () => ({ authenticateRequest: vi.fn() }));
vi.mock("@/modules/core/rate-limit/helpers", () => ({
  applyRateLimit: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({ queueAuditEvent: mocks.queueAuditEvent }));
vi.mock("@/app/lib/api/with-api-logging", () => ({
  buildAuditLogBaseObject: vi.fn((action: string, targetType: string) => ({
    action,
    targetType,
    status: "failure",
  })),
}));
vi.mock("@formbricks/logger", () => ({
  logger: { withContext: vi.fn(() => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() })), error: vi.fn() },
}));
vi.mock("server-only", () => ({}));

const USER_ID = "cluser1111111111111111111";
const ORG_ID = "clorg11111111111111111111";
const SURVEY_ID = "clsurvey11111111111111111";

const reset = () =>
  POST(
    new NextRequest(`http://localhost/api/internal/surveys/${SURVEY_ID}/resets`, {
      method: "POST",
      headers: SAME_ORIGIN_HEADERS,
    }),
    { params: Promise.resolve({ surveyId: SURVEY_ID }) } as never
  );

const checkedActions = () => mocks.can.mock.calls.map(([, action, resource]) => [action, resource]);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({ user: { id: USER_ID } });
  mocks.can.mockResolvedValue(true);
  mocks.getOrganizationIdFromSurveyId.mockResolvedValue(ORG_ID);
  mocks.getSurvey.mockResolvedValue({ id: SURVEY_ID, archivedAt: null });
  mocks.deleteResponsesAndDisplaysForSurvey.mockResolvedValue({
    deletedResponsesCount: 3,
    deletedDisplaysCount: 5,
  });
});

describe("POST /api/internal/surveys/{surveyId}/resets", () => {
  test("resets the survey once survey.manage is granted, and audits the counts", async () => {
    const response = await reset();

    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual({
      surveyId: SURVEY_ID,
      deletedResponsesCount: 3,
      deletedDisplaysCount: 5,
    });
    expect(mocks.deleteResponsesAndDisplaysForSurvey).toHaveBeenCalledWith(SURVEY_ID);
    expect(mocks.queueAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "updated",
        targetType: "survey",
        status: "success",
        organizationId: ORG_ID,
        targetId: SURVEY_ID,
        oldObject: null,
        newObject: { deletedResponsesCount: 3, deletedDisplaysCount: 5 },
      })
    );
  });

  test("requires manage access on the survey itself, not write access or workspace manage", async () => {
    await reset();
    expect(checkedActions()).toEqual([["survey.manage", { type: "survey", id: SURVEY_ID }]]);
  });

  // A non-owner with a team Manage grant passes any workspace-level check; only the survey policy denies
  // them on a private survey or while a visibility change is pending (ENG-3282).
  test.each(["a private survey", "a survey with a pending visibility change"])(
    "deletes nothing for a team Manage member on %s, and audits the refusal",
    async () => {
      mocks.can.mockImplementation(async (_actor, action: string) => action === "workspace.manage");

      const response = await reset();

      expect(response.status).toBe(403);
      expect((await response.json()).detail).toBe("You are not authorized to access this resource");
      expect(mocks.getSurvey).not.toHaveBeenCalled();
      expect(mocks.deleteResponsesAndDisplaysForSurvey).not.toHaveBeenCalled();
      expect(mocks.queueAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({ action: "updated", status: "failure", organizationId: ORG_ID })
      );
    }
  );

  test("refuses an archived survey with the reason, deleting nothing", async () => {
    mocks.getSurvey.mockResolvedValue({ id: SURVEY_ID, archivedAt: new Date("2026-11-01T00:00:00.000Z") });

    const response = await reset();

    expect(response.status).toBe(403);
    expect((await response.json()).detail).toBe("Cannot reset an archived survey.");
    expect(mocks.deleteResponsesAndDisplaysForSurvey).not.toHaveBeenCalled();
  });

  test.each([
    [
      "before the check",
      () =>
        mocks.getOrganizationIdFromSurveyId.mockRejectedValue(new ResourceNotFoundError("Survey", SURVEY_ID)),
    ],
    ["after the check", () => mocks.getSurvey.mockResolvedValue(null)],
  ])("answers the uniform 403 for a survey that is gone %s", async (_label, arrange) => {
    arrange();

    const response = await reset();

    expect(response.status).toBe(403);
    expect((await response.json()).detail).toBe("You are not authorized to access this resource");
    expect(mocks.deleteResponsesAndDisplaysForSurvey).not.toHaveBeenCalled();
  });
});
