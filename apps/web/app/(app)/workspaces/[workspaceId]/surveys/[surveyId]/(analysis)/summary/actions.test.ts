import { beforeEach, describe, expect, test, vi } from "vitest";
import { AuthorizationError } from "@formbricks/types/errors";

const mocks = vi.hoisted(() => ({
  assertCan: vi.fn(),
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
  getWorkspaceIdFromSurveyId: vi.fn(),
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
    parsedInput: { surveyId: "survey1", workspaceId: "ws1" },
  });

describe("resetSurveyAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.assertCan.mockResolvedValue(undefined);
    mocks.getSurvey.mockResolvedValue({ id: "survey1", archivedAt: null });
    mocks.deleteResponsesAndDisplaysForSurvey.mockResolvedValue({
      deletedResponsesCount: 3,
      deletedDisplaysCount: 5,
    });
  });

  test("requires manage access on the survey itself, not write access or workspace manage", async () => {
    await callReset();

    expect(mocks.assertCan).toHaveBeenCalledTimes(1);
    expect(mocks.assertCan).toHaveBeenCalledWith({ type: "user", id: "user1" }, "survey.manage", {
      type: "survey",
      id: "survey1",
    });
  });

  // A non-owner with a team Manage grant passes any workspace-level check; only the survey policy denies
  // them on a private survey or while a visibility change is pending (ENG-3282).
  test.each(["a private survey", "a survey with a pending visibility change"])(
    "deletes nothing for a team Manage member on %s",
    async () => {
      mocks.assertCan.mockImplementation(async (_actor: unknown, action: string) => {
        if (action !== "workspace.manage") throw new AuthorizationError("Not authorized");
      });

      await expect(callReset()).rejects.toThrow(AuthorizationError);
      expect(mocks.getSurvey).not.toHaveBeenCalled();
      expect(mocks.deleteResponsesAndDisplaysForSurvey).not.toHaveBeenCalled();
    }
  );

  test("resets the survey once survey.manage is granted", async () => {
    await expect(callReset()).resolves.toEqual({
      success: true,
      deletedResponsesCount: 3,
      deletedDisplaysCount: 5,
    });
    expect(mocks.deleteResponsesAndDisplaysForSurvey).toHaveBeenCalledWith("survey1");
  });
});
