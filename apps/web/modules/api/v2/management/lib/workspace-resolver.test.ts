import { beforeEach, describe, expect, test, vi } from "vitest";
import { ApiKeyPermission } from "@formbricks/database/prisma";
import { findWorkspaceByIdOrLegacyEnvId } from "@/lib/utils/resolve-client-id";
import { resolveBodyIdsV2 } from "./workspace-resolver";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/utils/resolve-client-id", () => ({
  findWorkspaceByIdOrLegacyEnvId: vi.fn(),
}));

const auth = (organizationId: string, workspaceId: string, permission: ApiKeyPermission) => ({
  organizationId,
  workspacePermissions: [{ workspaceId, permission }],
});

describe("resolveBodyIdsV2", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns bad_request when no workspaceId/environmentId is provided", async () => {
    const result = await resolveBodyIdsV2({}, auth("org1", "ws1", ApiKeyPermission.manage), "POST");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.type).toBe("bad_request");
    expect(findWorkspaceByIdOrLegacyEnvId).not.toHaveBeenCalled();
  });

  test("returns not_found when the workspace does not exist", async () => {
    vi.mocked(findWorkspaceByIdOrLegacyEnvId).mockResolvedValueOnce(null);

    const result = await resolveBodyIdsV2(
      { workspaceId: "ws-missing" },
      auth("org1", "ws-missing", ApiKeyPermission.manage),
      "POST"
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.type).toBe("not_found");
  });

  // ENG-1749 defense-in-depth: a permission row for a workspace in another organization must not
  // grant access, even though hasPermission alone would match on workspaceId.
  test("returns forbidden when the workspace belongs to a different organization", async () => {
    vi.mocked(findWorkspaceByIdOrLegacyEnvId).mockResolvedValueOnce({
      id: "victim-ws",
      organizationId: "victim-org",
    });

    const result = await resolveBodyIdsV2(
      { workspaceId: "victim-ws" },
      // Attacker's key carries a (illegitimate) manage permission on the victim workspace.
      auth("attacker-org", "victim-ws", ApiKeyPermission.manage),
      "POST"
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.type).toBe("forbidden");
  });

  test("returns forbidden when the key lacks permission for an in-org workspace", async () => {
    vi.mocked(findWorkspaceByIdOrLegacyEnvId).mockResolvedValueOnce({
      id: "ws1",
      organizationId: "org1",
    });

    const result = await resolveBodyIdsV2(
      { workspaceId: "ws1" },
      auth("org1", "ws1", ApiKeyPermission.read), // read cannot POST (needs write)
      "POST"
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.type).toBe("forbidden");
  });

  test("resolves the workspaceId for a same-org workspace the key can access", async () => {
    vi.mocked(findWorkspaceByIdOrLegacyEnvId).mockResolvedValueOnce({
      id: "ws1",
      organizationId: "org1",
    });

    const result = await resolveBodyIdsV2(
      { workspaceId: "ws1" },
      auth("org1", "ws1", ApiKeyPermission.manage),
      "POST"
    );

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toEqual({ workspaceId: "ws1" });
  });
});
