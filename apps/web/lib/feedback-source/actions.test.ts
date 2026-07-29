import { beforeEach, describe, expect, test, vi } from "vitest";
import { AuthorizationError, ResourceNotFoundError } from "@formbricks/types/errors";

const mocks = vi.hoisted(() => ({
  checkAuthorizationUpdated: vi.fn(),
  getOrganizationIdFromFeedbackSourceId: vi.fn(),
  getFeedbackSourceWithMappingsById: vi.fn(),
  getSurvey: vi.fn(),
  importHistoricalResponses: vi.fn(),
}));

vi.mock("@/lib/utils/action-client", () => ({
  authenticatedActionClient: {
    inputSchema: vi.fn(() => ({ action: vi.fn((fn) => fn) })),
  },
}));

vi.mock("@/lib/utils/action-client/action-client-middleware", () => ({
  checkAuthorizationUpdated: mocks.checkAuthorizationUpdated,
}));

vi.mock("@/lib/utils/helper", () => ({
  getOrganizationIdFromFeedbackSourceId: mocks.getOrganizationIdFromFeedbackSourceId,
  getOrganizationIdFromSurveyId: vi.fn(),
  getOrganizationIdFromWorkspaceId: vi.fn(),
}));

vi.mock("./service", () => ({
  createFeedbackSourceWithMappings: vi.fn(),
  deleteFeedbackSource: vi.fn(),
  getFeedbackSourceWithMappingsById: mocks.getFeedbackSourceWithMappingsById,
  updateFeedbackSourceWithMappings: vi.fn(),
}));

vi.mock("./import", () => ({ importHistoricalResponses: mocks.importHistoricalResponses }));
vi.mock("@/lib/survey/service", () => ({ getSurvey: mocks.getSurvey }));
vi.mock("@/lib/response/service", () => ({ getResponseCountBySurveyId: vi.fn() }));
vi.mock("@/lib/survey/utils", () => ({ getElementsFromBlocks: vi.fn(() => []) }));
vi.mock("@/modules/ee/feedback-directory/lib/feedback-directory", () => ({
  getFeedbackDirectoriesByWorkspaceId: vi.fn(),
}));
vi.mock("@/modules/ee/unify-feedback/lib/contacts", () => ({ getContactIdsByUserIds: vi.fn() }));
vi.mock("@/modules/hub/service", () => ({ listFeedbackRecords: vi.fn() }));
vi.mock("@formbricks/database", () => ({ prisma: {} }));
vi.mock("@formbricks/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn() } }));

const { importHistoricalResponsesAction } = await import("./actions");

const AUTHORIZED_WORKSPACE = "ws_authorized";
const FOREIGN_WORKSPACE = "ws_other_tenant";
const SURVEY_ID = "survey_target";

const ctx = { user: { id: "user_1" }, auditLoggingCtx: {} } as never;
const input = {
  feedbackSourceId: "fs_1",
  workspaceId: AUTHORIZED_WORKSPACE,
  surveyId: SURVEY_ID,
};

describe("importHistoricalResponsesAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getOrganizationIdFromFeedbackSourceId.mockResolvedValue("org_1");
    mocks.checkAuthorizationUpdated.mockResolvedValue(true);
    mocks.getFeedbackSourceWithMappingsById.mockResolvedValue({ id: "fs_1", mappings: [] });
    mocks.importHistoricalResponses.mockResolvedValue({ imported: 3 });
  });

  // Regression: the authorization above this check covers the *feedback source's* workspace, not the
  // survey's. Without the ownership check a caller with readWrite on one workspace could name a survey
  // from another organization and have every one of its responses copied into their own directory.
  // Survey ids are not secret — they appear in every /s/<surveyId> link.
  test("refuses a survey that belongs to another workspace", async () => {
    mocks.getSurvey.mockResolvedValue({ id: SURVEY_ID, workspaceId: FOREIGN_WORKSPACE });

    await expect(importHistoricalResponsesAction({ ctx, parsedInput: input } as never)).rejects.toThrow(
      ResourceNotFoundError
    );

    expect(mocks.importHistoricalResponses).not.toHaveBeenCalled();
  });

  // Not-found rather than not-authorized on purpose: "you may not read this" would confirm the id
  // exists, turning the endpoint into a cross-tenant survey-existence oracle.
  test("reports a foreign survey as not found rather than unauthorized", async () => {
    mocks.getSurvey.mockResolvedValue({ id: SURVEY_ID, workspaceId: FOREIGN_WORKSPACE });

    const error = await importHistoricalResponsesAction({ ctx, parsedInput: input } as never).catch(
      (e: unknown) => e
    );

    expect(error).toBeInstanceOf(ResourceNotFoundError);
    expect(error).not.toBeInstanceOf(AuthorizationError);
  });

  test("imports a survey that belongs to the authorized workspace", async () => {
    mocks.getSurvey.mockResolvedValue({ id: SURVEY_ID, workspaceId: AUTHORIZED_WORKSPACE });

    await expect(importHistoricalResponsesAction({ ctx, parsedInput: input } as never)).resolves.toEqual({
      imported: 3,
    });

    expect(mocks.importHistoricalResponses).toHaveBeenCalledWith(
      { id: "fs_1", mappings: [] },
      { id: SURVEY_ID, workspaceId: AUTHORIZED_WORKSPACE }
    );
  });

  test("still rejects a survey that does not exist at all", async () => {
    mocks.getSurvey.mockResolvedValue(null);

    await expect(importHistoricalResponsesAction({ ctx, parsedInput: input } as never)).rejects.toThrow(
      ResourceNotFoundError
    );
    expect(mocks.importHistoricalResponses).not.toHaveBeenCalled();
  });

  test("rejects before importing when the feedback source is missing", async () => {
    mocks.getFeedbackSourceWithMappingsById.mockResolvedValue(null);

    await expect(importHistoricalResponsesAction({ ctx, parsedInput: input } as never)).rejects.toThrow(
      ResourceNotFoundError
    );
    expect(mocks.getSurvey).not.toHaveBeenCalled();
  });
});
