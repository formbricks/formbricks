import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { queueAuditEvent } from "@/modules/ee/audit-logs/lib/handler";
import { deleteSurvey } from "./surveys";

const { mockDeleteSharedSurvey } = vi.hoisted(() => ({
  mockDeleteSharedSurvey: vi.fn(),
}));

vi.mock("@/modules/survey/lib/surveys", () => ({
  deleteSurvey: mockDeleteSharedSurvey,
}));

vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({
  queueAuditEvent: vi.fn(),
}));

const surveyId = "clq5n7p1q0000m7z0h5p6g3r2";
const workspaceId = "clq5n7p1q0000m7z0h5p6g3r3";

const mockDeletedSurveyLink = {
  id: surveyId,
  workspaceId,
  type: "link",
  segment: null,
  triggers: [],
};

describe("deleteSurvey", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("delegates survey deletion to the shared service", async () => {
    mockDeleteSharedSurvey.mockResolvedValue(mockDeletedSurveyLink);

    const deletedSurvey = await deleteSurvey(surveyId);

    expect(mockDeleteSharedSurvey).toHaveBeenCalledWith(surveyId, {
      onCreativesUnlinked: expect.any(Function),
    });
    expect(deletedSurvey).toEqual(mockDeletedSurveyLink);
  });

  test("audits each archived creative the delete unlinked under the request's own actor", async () => {
    mockDeleteSharedSurvey.mockResolvedValue(mockDeletedSurveyLink);
    const auditLog = {
      action: "deleted",
      targetType: "survey",
      targetId: surveyId,
      userId: "key_1",
      userType: "api",
      organizationId: "org_1",
      status: "failure",
      apiUrl: "http://localhost/api/v1/management/surveys",
    } as const;

    await deleteSurvey(surveyId, { ...auditLog });
    const [[, options]] = mockDeleteSharedSurvey.mock.calls;
    await options.onCreativesUnlinked([{ id: "cr_1", name: "Old tab" }], { organizationId: "org_1" });

    expect(queueAuditEvent).toHaveBeenCalledWith({
      userId: "key_1",
      userType: "api",
      organizationId: "org_1",
      apiUrl: "http://localhost/api/v1/management/surveys",
      action: "updated",
      targetType: "creative",
      targetId: "cr_1",
      status: "success",
      oldObject: { surveyId },
      newObject: { surveyId: null },
    });
  });

  test("rethrows shared delete service errors", async () => {
    const genericError = new Error("Something went wrong");
    mockDeleteSharedSurvey.mockRejectedValue(genericError);

    await expect(deleteSurvey(surveyId)).rejects.toThrow(genericError);
  });
});
