import { beforeEach, describe, expect, test, vi } from "vitest";
import { AuthorizationError, InvalidInputError } from "@formbricks/types/errors";
import { createFeedbackSourceWithMappingsAction } from "./actions";

const mocks = vi.hoisted(() => {
  const actionClientAction = vi.fn((fn) => fn);
  return {
    actionClientAction,
    actionClientInputSchema: vi.fn(() => ({ action: actionClientAction })),
    checkAuthorizationUpdated: vi.fn(),
    getOrganizationIdFromWorkspaceId: vi.fn(),
    getOrganizationIdFromSurveyId: vi.fn(),
    getOrganizationIdFromFeedbackSourceId: vi.fn(),
    feedbackDirectoryFindUnique: vi.fn(),
    createFeedbackSourceWithMappings: vi.fn(),
    sanitizeCsvFieldMappings: vi.fn(),
    getMissingRequiredCsvFieldMappings: vi.fn(),
  };
});

vi.mock("server-only", () => ({}));

vi.mock("@formbricks/database", () => ({
  prisma: { feedbackDirectory: { findUnique: mocks.feedbackDirectoryFindUnique } },
}));

vi.mock("@formbricks/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

vi.mock("@/lib/utils/action-client", () => ({
  authenticatedActionClient: { inputSchema: mocks.actionClientInputSchema },
}));

vi.mock("@/lib/utils/action-client/action-client-middleware", () => ({
  checkAuthorizationUpdated: mocks.checkAuthorizationUpdated,
}));

vi.mock("@/lib/utils/helper", () => ({
  getOrganizationIdFromWorkspaceId: mocks.getOrganizationIdFromWorkspaceId,
  getOrganizationIdFromSurveyId: mocks.getOrganizationIdFromSurveyId,
  getOrganizationIdFromFeedbackSourceId: mocks.getOrganizationIdFromFeedbackSourceId,
}));

vi.mock("@/lib/response/service", () => ({ getResponseCountBySurveyId: vi.fn() }));
vi.mock("@/lib/survey/service", () => ({ getSurvey: vi.fn() }));
vi.mock("@/lib/survey/utils", () => ({ getElementsFromBlocks: vi.fn() }));
vi.mock("@/modules/ee/feedback-directory/lib/feedback-directory", () => ({
  getFeedbackDirectoriesByWorkspaceId: vi.fn(),
}));
vi.mock("@/modules/hub/service", () => ({ listFeedbackRecords: vi.fn() }));
vi.mock("./csv-import", () => ({ importCsvData: vi.fn() }));
vi.mock("./import", () => ({ importHistoricalResponses: vi.fn() }));

vi.mock("./service", () => ({
  createFeedbackSourceWithMappings: mocks.createFeedbackSourceWithMappings,
  deleteFeedbackSource: vi.fn(),
  getFeedbackSourceWithMappingsById: vi.fn(),
  updateFeedbackSource: vi.fn(),
  updateFeedbackSourceWithMappings: vi.fn(),
}));

vi.mock("./utils", () => ({
  sanitizeCsvFieldMappings: mocks.sanitizeCsvFieldMappings,
  getMissingRequiredCsvFieldMappings: mocks.getMissingRequiredCsvFieldMappings,
  formatMissingRequiredCsvFieldMappingsMessage: vi.fn(() => "MISSING"),
}));

const WORKSPACE_ID = "clworkspace000000000001";
const ORG_ID = "clorg0000000000000000001";
const FRD_ID = "clfrd0000000000000000001";
const ctx = { user: { id: "user-1" }, auditLoggingCtx: {} };

const csvInput = {
  workspaceId: WORKSPACE_ID,
  feedbackSourceInput: { name: "CSV Source", type: "csv" as const, feedbackDirectoryId: FRD_ID },
  fieldMappings: [{ sourceFieldId: "col", targetFieldId: "value_text" }],
};

describe("createFeedbackSourceWithMappingsAction — directory assignment guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.actionClientAction.mockImplementation((fn) => fn);
    mocks.actionClientInputSchema.mockReturnValue({ action: mocks.actionClientAction });
    mocks.getOrganizationIdFromWorkspaceId.mockResolvedValue(ORG_ID);
    mocks.checkAuthorizationUpdated.mockResolvedValue(undefined);
  });

  test("throws AuthorizationError when the directory belongs to a different org", async () => {
    mocks.feedbackDirectoryFindUnique.mockResolvedValue({ organizationId: "other-org", workspaces: [] });

    await expect(createFeedbackSourceWithMappingsAction({ ctx, parsedInput: csvInput })).rejects.toThrow(
      AuthorizationError
    );
    expect(mocks.createFeedbackSourceWithMappings).not.toHaveBeenCalled();
  });

  test("throws AuthorizationError when the directory does not exist", async () => {
    mocks.feedbackDirectoryFindUnique.mockResolvedValue(null);

    await expect(createFeedbackSourceWithMappingsAction({ ctx, parsedInput: csvInput })).rejects.toThrow(
      AuthorizationError
    );
  });

  test("throws FEEDBACK_SOURCE_DIRECTORY_NOT_ASSIGNED_TO_WORKSPACE for a same-org unassigned directory", async () => {
    // Same org, but the workspace is not in the directory's assignment list.
    mocks.feedbackDirectoryFindUnique.mockResolvedValue({ organizationId: ORG_ID, workspaces: [] });

    await expect(createFeedbackSourceWithMappingsAction({ ctx, parsedInput: csvInput })).rejects.toThrow(
      new InvalidInputError("FEEDBACK_SOURCE_DIRECTORY_NOT_ASSIGNED_TO_WORKSPACE")
    );
    expect(mocks.createFeedbackSourceWithMappings).not.toHaveBeenCalled();
  });

  test("proceeds to create when the directory is assigned to the workspace", async () => {
    mocks.feedbackDirectoryFindUnique.mockResolvedValue({
      organizationId: ORG_ID,
      workspaces: [{ workspaceId: WORKSPACE_ID }],
    });
    mocks.sanitizeCsvFieldMappings.mockReturnValue(csvInput.fieldMappings);
    mocks.getMissingRequiredCsvFieldMappings.mockReturnValue([]);
    mocks.createFeedbackSourceWithMappings.mockResolvedValue({ id: "src-1" });

    const result = await createFeedbackSourceWithMappingsAction({ ctx, parsedInput: csvInput });

    expect(result).toEqual({ id: "src-1" });
    expect(mocks.createFeedbackSourceWithMappings).toHaveBeenCalledWith(
      WORKSPACE_ID,
      expect.objectContaining({ feedbackDirectoryId: FRD_ID, createdBy: "user-1" }),
      expect.objectContaining({ type: "field" })
    );
  });
});
