import { beforeEach, describe, expect, test, vi } from "vitest";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { can } from "@/lib/authorization";
import { getOrganizationIdFromDirectoryId } from "@/modules/ee/feedback-directory/lib/feedback-directory";
import { getIsFeedbackDirectoriesEnabled } from "@/modules/ee/license-check/lib/utils";
import { requireFeedbackDatasetMutationAccess } from "./access";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/authorization", () => ({
  can: vi.fn(),
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
  vi.mocked(can).mockResolvedValue(true);
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
    expect(can).toHaveBeenCalledWith({ type: "user", id: "user_1" }, "organization.manage", {
      type: "organization",
      id: "org_other",
    });
  });

  test("rejects a caller who is not an owner or manager", async () => {
    vi.mocked(can).mockResolvedValue(false);

    const result = await requireFeedbackDatasetMutationAccess(session, ...args);

    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(403);
  });

  test("rejects an unauthenticated caller before touching the dataset", async () => {
    const result = await requireFeedbackDatasetMutationAccess(null, ...args);

    expect((result as Response).status).toBe(401);
    expect(getOrganizationIdFromDirectoryId).not.toHaveBeenCalled();
  });

  // A missing dataset and someone else's dataset must be indistinguishable, or the endpoint tells a
  // stranger whether any given dataset id exists.
  test("gives a missing dataset the same response as one the caller cannot reach", async () => {
    vi.mocked(getOrganizationIdFromDirectoryId).mockRejectedValue(
      new ResourceNotFoundError("FeedbackDirectory", datasetId)
    );
    const missing = (await requireFeedbackDatasetMutationAccess(session, ...args)) as Response;

    vi.mocked(getOrganizationIdFromDirectoryId).mockResolvedValue("org_1");
    vi.mocked(can).mockResolvedValue(false);
    const forbidden = (await requireFeedbackDatasetMutationAccess(session, ...args)) as Response;

    expect(missing.status).toBe(403);
    expect(forbidden.status).toBe(missing.status);
    await expect(forbidden.json()).resolves.toMatchObject((await missing.json()) as Record<string, unknown>);
  });

  // The entitlement message names the org's plan, so a non-member must never reach it.
  test("checks the caller's role before revealing the organization's license state", async () => {
    vi.mocked(getIsFeedbackDirectoriesEnabled).mockResolvedValue(false);
    vi.mocked(can).mockResolvedValue(false);

    const result = (await requireFeedbackDatasetMutationAccess(session, ...args)) as Response;

    expect(result.status).toBe(403);
    await expect(result.json()).resolves.toMatchObject({
      detail: expect.not.stringContaining("Enterprise"),
    });
  });

  test("tells an owner of an unlicensed organization why it is blocked", async () => {
    vi.mocked(getIsFeedbackDirectoriesEnabled).mockResolvedValue(false);

    const result = (await requireFeedbackDatasetMutationAccess(session, ...args)) as Response;

    expect(result.status).toBe(403);
    await expect(result.json()).resolves.toMatchObject({
      detail: expect.stringContaining("Enterprise"),
    });
  });

  // An unexpected failure must not read as "allowed".
  test("rethrows an unexpected authorization error", async () => {
    vi.mocked(can).mockRejectedValue(new Error("db down"));

    await expect(requireFeedbackDatasetMutationAccess(session, ...args)).rejects.toThrow("db down");
  });
});
