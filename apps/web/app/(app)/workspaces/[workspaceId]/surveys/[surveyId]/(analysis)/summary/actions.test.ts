import { beforeEach, describe, expect, test, vi } from "vitest";
import { AuthorizationError } from "@formbricks/types/errors";

const mocks = vi.hoisted(() => ({
  assertCan: vi.fn(),
  getWorkspaceIdFromSurveyId: vi.fn(),
  getSurvey: vi.fn(),
  deleteResponsesAndDisplaysForSurvey: vi.fn(),
}));

vi.mock("@/lib/utils/action-client", () => ({
  authenticatedActionClient: {
    inputSchema: vi.fn(() => ({ action: vi.fn((fn) => fn) })),
  },
}));

vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({
  withAuditLogging: vi.fn((_event, _object, fn) => fn),
}));

vi.mock("@/lib/authorization", () => ({ assertCan: mocks.assertCan }));

vi.mock("@/lib/utils/helper", () => ({
  getOrganizationIdFromSurveyId: vi.fn().mockResolvedValue("org1"),
  getWorkspaceIdFromSurveyId: mocks.getWorkspaceIdFromSurveyId,
}));

vi.mock("@/lib/survey/service", () => ({ getSurvey: mocks.getSurvey, updateSurvey: vi.fn() }));

vi.mock("./lib/survey", () => ({
  deleteResponsesAndDisplaysForSurvey: mocks.deleteResponsesAndDisplaysForSurvey,
}));

vi.mock(
  "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/(analysis)/summary/lib/emailTemplate",
  () => ({
    getEmailTemplateHtml: vi.fn(),
  })
);
vi.mock(
  "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/(analysis)/summary/lib/example-responses",
  () => ({ generateExampleResponseDataset: vi.fn() })
);
vi.mock(
  "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/(analysis)/summary/lib/example-responses-persistence",
  () => ({ persistExampleResponseDataset: vi.fn() })
);
vi.mock("@/lib/ai/service", () => ({ assertOrganizationAIConfigured: vi.fn() }));
vi.mock("@/lib/posthog", () => ({ capturePostHogEvent: vi.fn() }));
vi.mock("@/lib/response/service", () => ({ getResponseCountBySurveyId: vi.fn() }));
vi.mock("@/lib/utils/file-conversion", () => ({ convertToCsv: vi.fn() }));
vi.mock("@/modules/core/rate-limit/helpers", () => ({ applyRateLimit: vi.fn() }));
vi.mock("@/modules/core/rate-limit/rate-limit-configs", () => ({ rateLimitConfigs: { actions: {} } }));
vi.mock("@/modules/ee/contacts/lib/contacts", () => ({ generatePersonalLinks: vi.fn() }));
vi.mock("@/modules/ee/contacts/lib/personal-link-errors", () => ({ NO_CONTACTS_IN_SEGMENT_ERROR_CODE: "x" }));
vi.mock("@/modules/ee/license-check/lib/utils", () => ({ getIsContactsEnabled: vi.fn() }));
vi.mock("@/modules/ee/whitelabel/email-customization/lib/organization", () => ({
  getOrganizationLogoUrl: vi.fn(),
}));
vi.mock("@/modules/email", () => ({ sendEmbedSurveyPreviewEmail: vi.fn() }));

const { resetSurveyAction } = await import("./actions");

const callReset = () =>
  (resetSurveyAction as unknown as (args: unknown) => Promise<unknown>)({
    ctx: { user: { id: "user1" }, auditLoggingCtx: {} },
    parsedInput: { surveyId: "survey1" },
  });

describe("resetSurveyAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.assertCan.mockResolvedValue(undefined);
    mocks.getWorkspaceIdFromSurveyId.mockResolvedValue("ws1");
    mocks.getSurvey.mockResolvedValue({ id: "survey1", archivedAt: null });
    mocks.deleteResponsesAndDisplaysForSurvey.mockResolvedValue({
      deletedResponsesCount: 3,
      deletedDisplaysCount: 5,
    });
  });

  test("requires manage access on the survey's workspace, not just write access", async () => {
    await callReset();

    expect(mocks.assertCan).toHaveBeenCalledWith({ type: "user", id: "user1" }, "workspace.manage", {
      type: "workspace",
      id: "ws1",
    });
  });

  test("deletes nothing when the caller lacks manage access", async () => {
    mocks.assertCan.mockRejectedValue(new AuthorizationError("Not authorized"));

    await expect(callReset()).rejects.toThrow(AuthorizationError);
    expect(mocks.deleteResponsesAndDisplaysForSurvey).not.toHaveBeenCalled();
  });
});
