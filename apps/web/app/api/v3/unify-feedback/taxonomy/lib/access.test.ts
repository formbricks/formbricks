import { beforeEach, describe, expect, test, vi } from "vitest";
import { getV3AuthorizationActor, requireV3WorkspaceAccess } from "@/app/api/v3/lib/auth";
import type { TV3Authentication } from "@/app/api/v3/lib/types";
import type { V3WorkspaceContext } from "@/app/api/v3/lib/workspace-context";
import { can } from "@/lib/authorization";
import { getIsFeedbackDirectoriesEnabled } from "@/modules/ee/license-check/lib/utils";
import { getSessionUserId, requireUnifyDirectoryAccess, requireUnifyDirectoryMutationAccess } from "./access";

vi.mock("server-only", () => ({}));

vi.mock("@/app/api/v3/lib/auth", () => ({
  getV3AuthorizationActor: vi.fn(),
  requireV3WorkspaceAccess: vi.fn(),
}));

vi.mock("@/lib/authorization", () => ({ can: vi.fn() }));

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
    vi.mocked(getV3AuthorizationActor).mockImplementation((authentication) =>
      authentication && "user" in authentication && authentication.user?.id
        ? { type: "user", id: authentication.user.id }
        : null
    );
    vi.mocked(getIsFeedbackDirectoriesEnabled).mockResolvedValue(true);
    vi.mocked(can).mockResolvedValue(true);
  });

  test("returns the workspace context when all checks pass", async () => {
    const result = await requireUnifyDirectoryAccess(
      session,
      workspaceId,
      directoryId,
      "read",
      "req_1",
      "/x"
    );
    expect(result).toEqual(context);
    expect(can).toHaveBeenCalledWith({ type: "user", id: "user_1" }, "feedbackDirectoryAssignment.read", {
      type: "feedbackDirectoryAssignment",
      feedbackDirectoryId: directoryId,
      workspaceId,
    });
  });

  test("short-circuits with the auth Response and skips the extra checks when workspace access is denied", async () => {
    const denied = new Response("forbidden", { status: 403 });
    vi.mocked(requireV3WorkspaceAccess).mockResolvedValue(denied);

    const result = await requireUnifyDirectoryAccess(null, workspaceId, directoryId, "read", "req_1", "/x");

    expect(result).toBe(denied);
    expect(getIsFeedbackDirectoriesEnabled).not.toHaveBeenCalled();
    expect(can).not.toHaveBeenCalled();
  });

  test("returns 403 when the feedbackDirectories entitlement is off", async () => {
    vi.mocked(getIsFeedbackDirectoriesEnabled).mockResolvedValue(false);

    const result = await requireUnifyDirectoryAccess(null, workspaceId, directoryId, "read", "req_1", "/x");

    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(403);
    expect(can).not.toHaveBeenCalled();
  });

  test("returns 403 when the directory is not assigned to the workspace", async () => {
    vi.mocked(can).mockResolvedValue(false);

    const result = await requireUnifyDirectoryAccess(
      session,
      workspaceId,
      directoryId,
      "read",
      "req_1",
      "/x"
    );

    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(403);
  });

  test("forwards the requested permission to the workspace-access check", async () => {
    await requireUnifyDirectoryAccess(session, workspaceId, directoryId, "readWrite", "req_1", "/x");
    expect(requireV3WorkspaceAccess).toHaveBeenCalledWith(session, workspaceId, "readWrite", "req_1", "/x");
    expect(can).toHaveBeenCalledWith({ type: "user", id: "user_1" }, "feedbackDirectoryAssignment.write", {
      type: "feedbackDirectoryAssignment",
      feedbackDirectoryId: directoryId,
      workspaceId,
    });
  });
});

// ENG-1770: a directory is shared across workspaces and its taxonomy carries no workspace, so
// changing it is gated on the organization role, not on a workspace permission.
describe("requireUnifyDirectoryMutationAccess", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(requireV3WorkspaceAccess).mockResolvedValue(context);
    vi.mocked(getV3AuthorizationActor).mockImplementation((authentication) =>
      authentication && "user" in authentication && authentication.user?.id
        ? { type: "user", id: authentication.user.id }
        : null
    );
    vi.mocked(getIsFeedbackDirectoriesEnabled).mockResolvedValue(true);
    vi.mocked(can).mockResolvedValue(true);
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
    expect(can).toHaveBeenLastCalledWith({ type: "user", id: "user_1" }, "organization.manage", {
      type: "organization",
      id: context.organizationId,
    });
  });

  test("only needs workspace read from the workspace-access check, not readWrite", async () => {
    await requireUnifyDirectoryMutationAccess(session, workspaceId, directoryId, "req_1", "/x");
    expect(requireV3WorkspaceAccess).toHaveBeenCalledWith(session, workspaceId, "read", "req_1", "/x");
  });

  test("returns 403 for a workspace readWrite member who is not an owner or manager", async () => {
    vi.mocked(can).mockResolvedValueOnce(true).mockResolvedValueOnce(false);

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
    expect(can).not.toHaveBeenCalled();
  });

  test("short-circuits with the directory Response and skips the role check", async () => {
    vi.mocked(can).mockResolvedValue(false);

    const result = await requireUnifyDirectoryMutationAccess(
      session,
      workspaceId,
      directoryId,
      "req_1",
      "/x"
    );

    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(403);
    expect(can).toHaveBeenCalledTimes(1);
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
