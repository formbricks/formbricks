import { beforeEach, describe, expect, test, vi } from "vitest";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { getFeedbackDirectoriesByWorkspaceId } from "@/modules/ee/feedback-directory/lib/feedback-directory";
import { assertRecordBelongsToWorkspace, getWorkspaceDirectoryIds } from "./access";

vi.mock("server-only", () => ({}));

vi.mock("@/modules/ee/feedback-directory/lib/feedback-directory", () => ({
  getFeedbackDirectoriesByWorkspaceId: vi.fn(),
}));

const workspaceId = "clxx1234567890123456789012";
const sharedDirectoryId = "clfd1234567890123456789012";
const otherOrgDirectoryId = "clfx1234567890123456789012";
const recordId = "0197f5c8-9d3a-7b2e-8f41-2c6ad0e4b915";

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
