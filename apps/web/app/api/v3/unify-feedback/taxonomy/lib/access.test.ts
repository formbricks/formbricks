import { beforeEach, describe, expect, test, vi } from "vitest";
import { AuthorizationError } from "@formbricks/types/errors";
import { requireV3WorkspaceAccess } from "@/app/api/v3/lib/auth";
import type { TV3Authentication } from "@/app/api/v3/lib/types";
import type { V3WorkspaceContext } from "@/app/api/v3/lib/workspace-context";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import { getFeedbackDirectoriesByWorkspaceId } from "@/modules/ee/feedback-directory/lib/feedback-directory";
import { getIsFeedbackDirectoriesEnabled } from "@/modules/ee/license-check/lib/utils";
import { getSessionUserId, requireUnifyDirectoryAccess, requireUnifyDirectoryMutationAccess } from "./access";

vi.mock("server-only", () => ({}));

vi.mock("@/app/api/v3/lib/auth", () => ({
  requireV3WorkspaceAccess: vi.fn(),
}));

vi.mock("@/lib/utils/action-client/action-client-middleware", () => ({
  checkAuthorizationUpdated: vi.fn(),
}));

vi.mock("@/modules/ee/feedback-directory/lib/feedback-directory", () => ({
  getFeedbackDirectoriesByWorkspaceId: vi.fn(),
}));

vi.mock("@/modules/ee/license-check/lib/utils", () => ({
  getIsFeedbackDirectoriesEnabled: vi.fn(),
}));

const workspaceId = "clxx1234567890123456789012";
const directoryId = "clfd1234567890123456789012";
const context: V3WorkspaceContext = { workspaceId, organizationId: "org_1" };
const session = { user: { id: "user_1" } } as TV3Authentication;

describe("requireUnifyDirectoryAccess", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(requireV3WorkspaceAccess).mockResolvedValue(context);
    vi.mocked(getIsFeedbackDirectoriesEnabled).mockResolvedValue(true);
    vi.mocked(getFeedbackDirectoriesByWorkspaceId).mockResolvedValue([{ id: directoryId, name: "Dataset" }]);
  });

  test("returns the workspace context when all checks pass", async () => {
    const result = await requireUnifyDirectoryAccess(null, workspaceId, directoryId, "read", "req_1", "/x");
    expect(result).toEqual(context);
  });

  test("short-circuits with the auth Response and skips the extra checks when workspace access is denied", async () => {
    const denied = new Response("forbidden", { status: 403 });
    vi.mocked(requireV3WorkspaceAccess).mockResolvedValue(denied);

    const result = await requireUnifyDirectoryAccess(null, workspaceId, directoryId, "read", "req_1", "/x");

    expect(result).toBe(denied);
    expect(getIsFeedbackDirectoriesEnabled).not.toHaveBeenCalled();
    expect(getFeedbackDirectoriesByWorkspaceId).not.toHaveBeenCalled();
  });

  test("returns 403 when the feedbackDirectories entitlement is off", async () => {
    vi.mocked(getIsFeedbackDirectoriesEnabled).mockResolvedValue(false);

    const result = await requireUnifyDirectoryAccess(null, workspaceId, directoryId, "read", "req_1", "/x");

    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(403);
    expect(getFeedbackDirectoriesByWorkspaceId).not.toHaveBeenCalled();
  });

  test("returns 403 when the directory is not assigned to the workspace", async () => {
    vi.mocked(getFeedbackDirectoriesByWorkspaceId).mockResolvedValue([{ id: "other", name: "Other" }]);

    const result = await requireUnifyDirectoryAccess(null, workspaceId, directoryId, "read", "req_1", "/x");

    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(403);
  });

  test("forwards the requested permission to the workspace-access check", async () => {
    await requireUnifyDirectoryAccess(null, workspaceId, directoryId, "readWrite", "req_1", "/x");
    expect(requireV3WorkspaceAccess).toHaveBeenCalledWith(null, workspaceId, "readWrite", "req_1", "/x");
  });
});

// ENG-1770: a directory is shared across workspaces and its taxonomy carries no workspace, so
// changing it is gated on the organization role, not on a workspace permission.
describe("requireUnifyDirectoryMutationAccess", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(requireV3WorkspaceAccess).mockResolvedValue(context);
    vi.mocked(getIsFeedbackDirectoriesEnabled).mockResolvedValue(true);
    vi.mocked(getFeedbackDirectoriesByWorkspaceId).mockResolvedValue([{ id: directoryId, name: "Dataset" }]);
    vi.mocked(checkAuthorizationUpdated).mockResolvedValue(true);
  });

  test("returns the workspace context for an organization owner or manager", async () => {
    const result = await requireUnifyDirectoryMutationAccess(
      session,
      workspaceId,
      directoryId,
      "req_1",
      "/x"
    );

    expect(result).toEqual(context);
    expect(checkAuthorizationUpdated).toHaveBeenCalledWith({
      userId: "user_1",
      organizationId: context.organizationId,
      access: [{ type: "organization", roles: ["owner", "manager"] }],
    });
  });

  test("only needs workspace read from the workspace-access check, not readWrite", async () => {
    await requireUnifyDirectoryMutationAccess(session, workspaceId, directoryId, "req_1", "/x");
    expect(requireV3WorkspaceAccess).toHaveBeenCalledWith(session, workspaceId, "read", "req_1", "/x");
  });

  test("returns 403 for a workspace readWrite member who is not an owner or manager", async () => {
    vi.mocked(checkAuthorizationUpdated).mockRejectedValue(new AuthorizationError("Not authorized"));

    const result = await requireUnifyDirectoryMutationAccess(
      session,
      workspaceId,
      directoryId,
      "req_1",
      "/x"
    );

    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(403);
  });

  test("returns 401 when there is no session user", async () => {
    const result = await requireUnifyDirectoryMutationAccess(null, workspaceId, directoryId, "req_1", "/x");

    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(401);
    expect(checkAuthorizationUpdated).not.toHaveBeenCalled();
  });

  test("short-circuits with the directory Response and skips the role check", async () => {
    vi.mocked(getFeedbackDirectoriesByWorkspaceId).mockResolvedValue([{ id: "other", name: "Other" }]);

    const result = await requireUnifyDirectoryMutationAccess(
      session,
      workspaceId,
      directoryId,
      "req_1",
      "/x"
    );

    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(403);
    expect(checkAuthorizationUpdated).not.toHaveBeenCalled();
  });
});

describe("getSessionUserId", () => {
  test("returns the user id for a session", () => {
    expect(getSessionUserId({ user: { id: "user_1" } } as Parameters<typeof getSessionUserId>[0])).toBe(
      "user_1"
    );
  });

  test("returns null when there is no session user", () => {
    expect(getSessionUserId(null)).toBeNull();
    expect(getSessionUserId({ apiKeyId: "k" } as Parameters<typeof getSessionUserId>[0])).toBeNull();
  });
});
