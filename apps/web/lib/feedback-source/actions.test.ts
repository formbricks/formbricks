import { beforeEach, describe, expect, test, vi } from "vitest";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import {
  createFeedbackSourceWithMappingsAction,
  deleteFeedbackSourceAction,
  importHistoricalResponsesAction,
  updateFeedbackSourceWithMappingsAction,
} from "./actions";

const mocks = vi.hoisted(() => {
  const action = vi.fn((handler) => handler);
  return {
    action,
    inputSchema: vi.fn(() => ({ action })),
    applyRateLimit: vi.fn(),
    assertCan: vi.fn(),
    assertFeedbackSourceDirectoryAccess: vi.fn(),
    getOrganizationIdFromFeedbackSourceId: vi.fn(),
    getOrganizationIdFromWorkspaceId: vi.fn(),
    getFeedbackSourceWithMappingsById: vi.fn(),
    createFeedbackSourceWithMappings: vi.fn(),
    updateFeedbackSourceWithMappings: vi.fn(),
    deleteFeedbackSource: vi.fn(),
    importHistoricalResponses: vi.fn(),
    getSurvey: vi.fn(),
    feedbackDirectoryFindUnique: vi.fn(),
    feedbackSourceFindUnique: vi.fn(),
  };
});

vi.mock("server-only", () => ({}));
vi.mock("@formbricks/database", () => ({
  prisma: {
    feedbackDirectory: { findUnique: mocks.feedbackDirectoryFindUnique },
    feedbackSource: { findUnique: mocks.feedbackSourceFindUnique },
  },
}));
vi.mock("@/lib/utils/action-client", () => ({
  authenticatedActionClient: { inputSchema: mocks.inputSchema },
}));
vi.mock("@/lib/authorization", () => ({
  assertCan: mocks.assertCan,
}));
vi.mock("@/lib/utils/helper", () => ({
  getOrganizationIdFromFeedbackSourceId: mocks.getOrganizationIdFromFeedbackSourceId,
  getOrganizationIdFromSurveyId: vi.fn(),
  getOrganizationIdFromWorkspaceId: mocks.getOrganizationIdFromWorkspaceId,
  getWorkspaceIdFromSurveyId: vi.fn(),
}));
vi.mock("@/lib/survey/service", () => ({ getSurvey: mocks.getSurvey }));
vi.mock("@/lib/response/service", () => ({ getResponseCountBySurveyId: vi.fn() }));
vi.mock("@/modules/core/rate-limit/helpers", () => ({ applyRateLimit: mocks.applyRateLimit }));
vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({
  withAuditLogging: vi.fn((_event, _target, handler) => handler),
}));
vi.mock("@/modules/ee/feedback-directory/lib/feedback-directory", () => ({
  getFeedbackDirectoriesByWorkspaceId: vi.fn(),
}));
vi.mock("@/modules/ee/unify-feedback/lib/contacts", () => ({ getContactIdsByUserIds: vi.fn() }));
vi.mock("@/modules/hub/service", () => ({ listFeedbackRecords: vi.fn() }));
vi.mock("./access", () => ({
  assertFeedbackSourceDirectoryAccess: mocks.assertFeedbackSourceDirectoryAccess,
}));
vi.mock("./import", () => ({ importHistoricalResponses: mocks.importHistoricalResponses }));
vi.mock("./mappings", () => ({ resolveFormbricksMappingsInput: vi.fn() }));
vi.mock("./service", () => ({
  createFeedbackSourceWithMappings: mocks.createFeedbackSourceWithMappings,
  deleteFeedbackSource: mocks.deleteFeedbackSource,
  getFeedbackSourceWithMappingsById: mocks.getFeedbackSourceWithMappingsById,
  updateFeedbackSourceWithMappings: mocks.updateFeedbackSourceWithMappings,
}));

const organizationId = "organization-1";
const workspaceId = "workspace-1";
const feedbackSourceId = "feedback-source-1";
const feedbackDirectoryId = "feedback-directory-1";
const ctx = { user: { id: "user-1" }, auditLoggingCtx: {} };

describe("feedback source mutation safeguards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ctx.auditLoggingCtx = {};
    mocks.getOrganizationIdFromFeedbackSourceId.mockResolvedValue(organizationId);
    mocks.getOrganizationIdFromWorkspaceId.mockResolvedValue(organizationId);
    mocks.feedbackDirectoryFindUnique.mockResolvedValue({
      organizationId,
      workspaces: [{ workspaceId }],
    });
    mocks.feedbackSourceFindUnique.mockResolvedValue({ feedbackDirectoryId, type: "csv" });
    mocks.getFeedbackSourceWithMappingsById.mockResolvedValue({
      id: feedbackSourceId,
      feedbackDirectoryId,
      type: "formbricks_survey",
      formbricksMappings: [],
    });
    mocks.createFeedbackSourceWithMappings.mockResolvedValue({
      id: feedbackSourceId,
      feedbackDirectoryId,
      type: "csv",
    });
    mocks.updateFeedbackSourceWithMappings.mockResolvedValue({
      id: feedbackSourceId,
      feedbackDirectoryId,
      type: "csv",
      name: "Renamed",
    });
    mocks.deleteFeedbackSource.mockResolvedValue({ id: feedbackSourceId });
    mocks.getSurvey.mockResolvedValue({ id: "survey-1", workspaceId });
    mocks.importHistoricalResponses.mockResolvedValue({ successes: 1, failures: 0, skipped: 0 });
  });

  test.each([
    [
      "create",
      createFeedbackSourceWithMappingsAction,
      {
        workspaceId,
        feedbackSourceInput: { feedbackDirectoryId, name: "Source", type: "csv" },
      },
    ],
    [
      "update",
      updateFeedbackSourceWithMappingsAction,
      { feedbackSourceId, workspaceId, feedbackSourceInput: {} },
    ],
    ["delete", deleteFeedbackSourceAction, { feedbackSourceId, workspaceId }],
  ])("rate limits and audits %s", async (_name, action, parsedInput) => {
    await (action as any)({ ctx, parsedInput });

    expect(mocks.applyRateLimit).toHaveBeenCalledWith(
      rateLimitConfigs.actions.feedbackSourceMutation,
      "user-1"
    );
    expect(ctx.auditLoggingCtx).toMatchObject({
      organizationId,
      workspaceId,
      feedbackSourceId,
    });
  });

  test("uses the tighter historical import rate limit and audits only summary counts", async () => {
    await (importHistoricalResponsesAction as any)({
      ctx,
      parsedInput: { feedbackSourceId, workspaceId, surveyId: "survey-1" },
    });

    expect(mocks.applyRateLimit).toHaveBeenCalledWith(
      rateLimitConfigs.actions.historicalResponseImport,
      "user-1"
    );
    expect(ctx.auditLoggingCtx).toMatchObject({
      organizationId,
      workspaceId,
      feedbackSourceId,
      newObject: { successes: 1, failures: 0, skipped: 0 },
    });
  });
});
