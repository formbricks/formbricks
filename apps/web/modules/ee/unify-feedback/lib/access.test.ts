import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  AuthorizationError,
  OperationNotAllowedError,
  ResourceNotFoundError,
} from "@formbricks/types/errors";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import { getOrganizationIdFromWorkspaceId } from "@/lib/utils/helper";
import { getFeedbackDirectoriesByWorkspaceId } from "@/modules/ee/feedback-directory/lib/feedback-directory";
import { getIsFeedbackDirectoriesEnabled } from "@/modules/ee/license-check/lib/utils";
import {
  assertRecordBelongsToWorkspace,
  ensureDeleteAccess,
  ensureReadAccess,
  getWorkspaceDirectoryIds,
} from "./access";

vi.mock("server-only", () => ({}));

vi.mock("@/modules/ee/feedback-directory/lib/feedback-directory", () => ({
  getFeedbackDirectoriesByWorkspaceId: vi.fn(),
}));

vi.mock("@/lib/utils/action-client/action-client-middleware", () => ({
  checkAuthorizationUpdated: vi.fn(),
}));

vi.mock("@/lib/utils/helper", () => ({
  getOrganizationIdFromWorkspaceId: vi.fn(),
}));

vi.mock("@/modules/ee/license-check/lib/utils", () => ({
  getIsFeedbackDirectoriesEnabled: vi.fn(),
}));

const workspaceId = "clxx1234567890123456789012";
const sharedDirectoryId = "clfd1234567890123456789012";
const otherOrgDirectoryId = "clfx1234567890123456789012";
const recordId = "0197f5c8-9d3a-7b2e-8f41-2c6ad0e4b915";
const organizationId = "clorg234567890123456789012";
const userId = "cluser23456789012345678901";

describe("getWorkspaceDirectoryIds", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test("collects the assigned directory ids", async () => {
    vi.mocked(getFeedbackDirectoriesByWorkspaceId).mockResolvedValue([
      { id: sharedDirectoryId, name: "Shared" },
      { id: "clfd9876543210987654321098", name: "Support" },
    ]);

    const ids = await getWorkspaceDirectoryIds(workspaceId);

    // Pins the scope of the lookup: the ids must come from the workspace that was asked for, since
    // the guard downstream compares a record's tenant against exactly this set.
    expect(getFeedbackDirectoriesByWorkspaceId).toHaveBeenCalledWith(workspaceId);
    expect(ids).toEqual(new Set([sharedDirectoryId, "clfd9876543210987654321098"]));
  });

  test("returns an empty set for a workspace with no directories", async () => {
    vi.mocked(getFeedbackDirectoriesByWorkspaceId).mockResolvedValue([]);

    expect(await getWorkspaceDirectoryIds(workspaceId)).toEqual(new Set());
  });
});

describe("assertRecordBelongsToWorkspace", () => {
  test("passes when the record's tenant is a directory assigned to the workspace", () => {
    expect(() =>
      assertRecordBelongsToWorkspace(new Set([sharedDirectoryId]), sharedDirectoryId, recordId)
    ).not.toThrow();
  });

  test("rejects a record from a directory the workspace is not assigned to", () => {
    expect(() =>
      assertRecordBelongsToWorkspace(new Set([sharedDirectoryId]), otherOrgDirectoryId, recordId)
    ).toThrow(ResourceNotFoundError);
  });

  test("rejects every record when the workspace has no directories", () => {
    expect(() => assertRecordBelongsToWorkspace(new Set(), sharedDirectoryId, recordId)).toThrow(
      ResourceNotFoundError
    );
  });

  // The error shape is deliberate: a "forbidden" would confirm the record exists, letting a caller
  // probe ids belonging to other organizations. It must stay indistinguishable from a real miss.
  test("reports a missing record rather than a refusal, so record ids cannot be probed", () => {
    let thrown: unknown;
    try {
      assertRecordBelongsToWorkspace(new Set([sharedDirectoryId]), otherOrgDirectoryId, recordId);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(ResourceNotFoundError);
    expect((thrown as ResourceNotFoundError).message).toBe(`Feedback record with ID ${recordId} not found`);
  });
});

describe("license gating", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getOrganizationIdFromWorkspaceId).mockResolvedValue(organizationId);
    vi.mocked(getIsFeedbackDirectoriesEnabled).mockResolvedValue(true);
    vi.mocked(checkAuthorizationUpdated).mockResolvedValue(true);
  });

  test.each([
    ["ensureReadAccess", ensureReadAccess],
    ["ensureDeleteAccess", ensureDeleteAccess],
  ])("%s refuses an unlicensed organization before checking the role", async (_name, ensureAccess) => {
    vi.mocked(getIsFeedbackDirectoriesEnabled).mockResolvedValue(false);

    await expect(ensureAccess(userId, workspaceId)).rejects.toThrow(OperationNotAllowedError);
    expect(checkAuthorizationUpdated).not.toHaveBeenCalled();
  });
});

// ENG-1770: a record's only tenancy is its directory, and a directory is shared across workspaces, so a
// workspace permission cannot tell one workspace's records from another's. Deleting is therefore
// organization-only, while reading stays open to the workspace.
describe("ensureDeleteAccess", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getOrganizationIdFromWorkspaceId).mockResolvedValue(organizationId);
    vi.mocked(getIsFeedbackDirectoriesEnabled).mockResolvedValue(true);
    vi.mocked(checkAuthorizationUpdated).mockResolvedValue(true);
  });

  // Re-adding a workspaceTeam entry to this access list is what reopens ENG-1770, so the list itself is
  // the thing under test — not merely that some check ran.
  test("requires an organization owner or manager, with no workspace-team fallback", async () => {
    await ensureDeleteAccess(userId, workspaceId);

    expect(checkAuthorizationUpdated).toHaveBeenCalledWith({
      userId,
      organizationId,
      access: [{ type: "organization", roles: ["owner", "manager"] }],
    });
  });

  test("returns the organization id so the caller can attribute the audit event", async () => {
    await expect(ensureDeleteAccess(userId, workspaceId)).resolves.toBe(organizationId);
  });

  test("propagates the refusal for a caller who is not an owner or manager", async () => {
    vi.mocked(checkAuthorizationUpdated).mockRejectedValue(new AuthorizationError("Not authorized"));

    await expect(ensureDeleteAccess(userId, workspaceId)).rejects.toThrow(AuthorizationError);
  });
});

describe("ensureReadAccess", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getOrganizationIdFromWorkspaceId).mockResolvedValue(organizationId);
    vi.mocked(getIsFeedbackDirectoriesEnabled).mockResolvedValue(true);
    vi.mocked(checkAuthorizationUpdated).mockResolvedValue(true);
  });

  test("also admits workspace readers, since reading the shared dataset is the point of sharing it", async () => {
    await ensureReadAccess(userId, workspaceId);

    expect(checkAuthorizationUpdated).toHaveBeenCalledWith({
      userId,
      organizationId,
      access: [
        { type: "organization", roles: ["owner", "manager"] },
        { type: "workspaceTeam", minPermission: "read", workspaceId },
      ],
    });
  });
});
