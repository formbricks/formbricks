import { beforeEach, describe, expect, test, vi } from "vitest";
import { logger } from "@formbricks/logger";
import { AuthorizationError } from "@formbricks/types/errors";
import { assertFeedbackSourceDirectoryAccess } from "@/lib/feedback-source/access";
import { importCsvFile } from "@/lib/feedback-source/csv-file-import";
import { getFeedbackSourceWithMappingsById } from "@/lib/feedback-source/service";
import { getUser } from "@/lib/user/service";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import { getOrganizationIdFromFeedbackSourceId } from "@/lib/utils/helper";
import { getSession } from "@/modules/auth/lib/session";
import { POST } from "./route";

vi.mock("@formbricks/logger", () => ({
  logger: { error: vi.fn() },
}));
vi.mock("@/lib/feedback-source/access", () => ({
  assertFeedbackSourceDirectoryAccess: vi.fn(),
}));
vi.mock("@/lib/feedback-source/csv-file-import", () => ({
  CsvImportValidationError: class CsvImportValidationError extends Error {},
  importCsvFile: vi.fn(),
}));
vi.mock("@/lib/feedback-source/service", () => ({
  getFeedbackSourceWithMappingsById: vi.fn(),
}));
vi.mock("@/lib/user/service", () => ({ getUser: vi.fn() }));
vi.mock("@/lib/utils/action-client/action-client-middleware", () => ({
  checkAuthorizationUpdated: vi.fn(),
}));
vi.mock("@/lib/utils/helper", () => ({
  getOrganizationIdFromFeedbackSourceId: vi.fn(),
}));
vi.mock("@/modules/auth/lib/session", () => ({ getSession: vi.fn() }));

const userId = "user_1";
const organizationId = "organization_1";
const workspaceId = "workspace_1";
const feedbackSourceId = "source_1";
const feedbackDirectoryId = "directory_1";

const makeRequest = (): Request => {
  const body = new FormData();
  body.set("workspaceId", workspaceId);
  body.set("feedbackSourceId", feedbackSourceId);
  body.set("file", new File(["value\nexample"], "feedback.csv", { type: "text/csv" }));
  return new Request("http://localhost/api/unify-feedback/sources/csv/import", { method: "POST", body });
};

describe("CSV feedback source import authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSession).mockResolvedValue({ user: { id: userId } } as never);
    vi.mocked(getUser).mockResolvedValue({ id: userId } as never);
    vi.mocked(getOrganizationIdFromFeedbackSourceId).mockResolvedValue(organizationId);
    vi.mocked(checkAuthorizationUpdated).mockResolvedValue(true);
    vi.mocked(getFeedbackSourceWithMappingsById).mockResolvedValue({ feedbackDirectoryId } as never);
    vi.mocked(assertFeedbackSourceDirectoryAccess).mockResolvedValue(undefined);
    vi.mocked(importCsvFile).mockResolvedValue({ imported: 1 } as never);
  });

  test("requires exact assignment write access before importing", async () => {
    const response = await POST(makeRequest());

    expect(response.status).toBe(200);
    expect(assertFeedbackSourceDirectoryAccess).toHaveBeenCalledWith(
      userId,
      feedbackDirectoryId,
      workspaceId,
      "write"
    );
    expect(importCsvFile).toHaveBeenCalledWith({ feedbackSourceId, workspaceId, file: expect.any(File) });
  });

  test("preserves the existing forbidden response for a denied assignment", async () => {
    vi.mocked(assertFeedbackSourceDirectoryAccess).mockRejectedValue(
      new AuthorizationError("Not authorized")
    );

    const response = await POST(makeRequest());

    expect(response.status).toBe(403);
    expect(importCsvFile).not.toHaveBeenCalled();
  });

  test("does not log identifiers or raw operational errors", async () => {
    vi.mocked(assertFeedbackSourceDirectoryAccess).mockRejectedValue(
      new Error(`evaluator failed for ${feedbackDirectoryId} and ${feedbackSourceId}`)
    );

    const response = await POST(makeRequest());

    expect(response.status).toBe(500);
    const logOutput = JSON.stringify(vi.mocked(logger.error).mock.calls);
    expect(logOutput).not.toContain(feedbackDirectoryId);
    expect(logOutput).not.toContain(feedbackSourceId);
    expect(logOutput).not.toContain("evaluator failed");
  });
});
