import { beforeEach, describe, expect, test, vi } from "vitest";
import { AuthorizationError, ResourceNotFoundError } from "@formbricks/types/errors";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import { getOrganizationIdFromDirectoryId } from "@/modules/ee/feedback-directory/lib/feedback-directory";
import { getIsFeedbackDirectoriesEnabled } from "@/modules/ee/license-check/lib/utils";
import { requireFeedbackDatasetMutationAccess } from "./access";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/utils/action-client/action-client-middleware", () => ({
  checkAuthorizationUpdated: vi.fn(),
}));

vi.mock("@/modules/ee/feedback-directory/lib/feedback-directory", () => ({
  getOrganizationIdFromDirectoryId: vi.fn(),
}));

vi.mock("@/modules/ee/license-check/lib/utils", () => ({
  getIsFeedbackDirectoriesEnabled: vi.fn(),
}));

const datasetId = "clfd1234567890123456789012";
const session = { user: { id: "user_1" } } as never;
const args = [datasetId, "req_1", "/api/internal/feedback-datasets/x/purge"] as const;

beforeEach(() => {
  vi.mocked(getOrganizationIdFromDirectoryId).mockResolvedValue("org_1");
  vi.mocked(getIsFeedbackDirectoriesEnabled).mockResolvedValue(true);
  vi.mocked(checkAuthorizationUpdated).mockResolvedValue(true as never);
});

describe("requireFeedbackDatasetMutationAccess", () => {
  test("returns the organization for an owner or manager", async () => {
    const result = await requireFeedbackDatasetMutationAccess(session, ...args);

    expect(result).toEqual({ organizationId: "org_1" });
  });

  // The organization must be derived from the dataset, never taken from the caller — otherwise a
  // caller could reach another organization's dataset by supplying its id.
  test("checks the caller's role against the dataset's own organization", async () => {
    vi.mocked(getOrganizationIdFromDirectoryId).mockResolvedValue("org_other");

    await requireFeedbackDatasetMutationAccess(session, ...args);

    expect(getOrganizationIdFromDirectoryId).toHaveBeenCalledWith(datasetId);
    expect(checkAuthorizationUpdated).toHaveBeenCalledWith({
      userId: "user_1",
      organizationId: "org_other",
      access: [{ type: "organization", roles: ["owner", "manager"] }],
    });
  });

  test("rejects a caller who is not an owner or manager", async () => {
    vi.mocked(checkAuthorizationUpdated).mockRejectedValue(new AuthorizationError("nope"));

    const result = await requireFeedbackDatasetMutationAccess(session, ...args);

    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(403);
  });

  test("rejects an unauthenticated caller before touching the dataset", async () => {
    const result = await requireFeedbackDatasetMutationAccess(null, ...args);

    expect((result as Response).status).toBe(401);
    expect(getOrganizationIdFromDirectoryId).not.toHaveBeenCalled();
  });

  test("returns 404 for a dataset that does not exist", async () => {
    vi.mocked(getOrganizationIdFromDirectoryId).mockRejectedValue(
      new ResourceNotFoundError("FeedbackDirectory", datasetId)
    );

    const result = await requireFeedbackDatasetMutationAccess(session, ...args);

    expect((result as Response).status).toBe(404);
    expect(checkAuthorizationUpdated).not.toHaveBeenCalled();
  });

  // An unlicensed organization should be told that, rather than told it lacks permission.
  test("rejects an organization without the feedback-directories license", async () => {
    vi.mocked(getIsFeedbackDirectoriesEnabled).mockResolvedValue(false);

    const result = await requireFeedbackDatasetMutationAccess(session, ...args);

    expect((result as Response).status).toBe(403);
    await expect((result as Response).json()).resolves.toMatchObject({
      detail: expect.stringContaining("Enterprise"),
    });
    expect(checkAuthorizationUpdated).not.toHaveBeenCalled();
  });

  // An unexpected failure must not read as "allowed".
  test("rethrows an unexpected authorization error", async () => {
    vi.mocked(checkAuthorizationUpdated).mockRejectedValue(new Error("db down"));

    await expect(requireFeedbackDatasetMutationAccess(session, ...args)).rejects.toThrow("db down");
  });
});
