import { beforeEach, describe, expect, test, vi } from "vitest";
import { AuthenticationError, AuthorizationError, ResourceNotFoundError } from "@formbricks/types/errors";
import type { TMembership, TOrganizationRole } from "@formbricks/types/memberships";
import type { TOrganization } from "@formbricks/types/organizations";
import type { TWorkspace } from "@formbricks/types/workspace";
import { getMembershipByUserIdOrganizationId } from "@/lib/membership/service";
import { getOrganization } from "@/lib/organization/service";
import { hasUserWorkspaceAccess } from "@/lib/workspace/auth";
import { getWorkspace } from "@/lib/workspace/service";
import { getSession } from "@/modules/auth/lib/session";
import { getWorkspacePermissionByUserId } from "@/modules/ee/teams/lib/roles";
import { getWorkspaceAuth } from "./utils";

vi.mock("@/lib/membership/service", () => ({
  getMembershipByUserIdOrganizationId: vi.fn(),
}));
vi.mock("@/lib/organization/service", () => ({
  getOrganization: vi.fn(),
  getMonthlyOrganizationResponseCount: vi.fn(),
}));
vi.mock("@/lib/workspace/service", () => ({
  getWorkspace: vi.fn(),
}));
vi.mock("@/lib/workspace/auth", () => ({
  hasUserWorkspaceAccess: vi.fn(),
}));
vi.mock("@/modules/ee/teams/lib/roles", () => ({
  getWorkspacePermissionByUserId: vi.fn(),
}));
vi.mock("@/lingodotdev/server", () => ({
  getTranslate: vi.fn(() => Promise.resolve((k: string) => k)),
}));
vi.mock("@/modules/auth/lib/session", () => ({
  getSession: vi.fn(),
}));
// getAccessFlags and getTeamPermissionFlags are intentionally NOT mocked: the
// real (pure) implementations exercise the true role → isReadOnly logic.
vi.mock("react", () => ({ cache: (fn: (...args: unknown[]) => unknown) => fn }));

const WORKSPACE_ID = "workspace-1";
const ORG_ID = "org-1";
const USER_ID = "user-1";

const mockSession = { user: { id: USER_ID }, expires: new Date().toISOString() };
const mockWorkspace = { id: WORKSPACE_ID, organizationId: ORG_ID } as unknown as TWorkspace;
const mockOrganization = { id: ORG_ID } as unknown as TOrganization;

const membershipWithRole = (role: TOrganizationRole): TMembership => ({
  role,
  organizationId: ORG_ID,
  userId: USER_ID,
  accepted: true,
});

describe("getWorkspaceAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Happy-path defaults: an org member with read-only workspace access.
    vi.mocked(getWorkspace).mockResolvedValue(mockWorkspace);
    vi.mocked(getSession).mockResolvedValue(mockSession);
    vi.mocked(getOrganization).mockResolvedValue(mockOrganization);
    vi.mocked(getMembershipByUserIdOrganizationId).mockResolvedValue(membershipWithRole("member"));
    vi.mocked(hasUserWorkspaceAccess).mockResolvedValue(true);
    vi.mocked(getWorkspacePermissionByUserId).mockResolvedValue("read");
  });

  test("throws ResourceNotFoundError when the workspace is missing", async () => {
    vi.mocked(getWorkspace).mockResolvedValue(null);
    await expect(getWorkspaceAuth(WORKSPACE_ID)).rejects.toThrow(ResourceNotFoundError);
  });

  test("throws AuthenticationError when there is no session", async () => {
    vi.mocked(getSession).mockResolvedValue(null);
    await expect(getWorkspaceAuth(WORKSPACE_ID)).rejects.toThrow(AuthenticationError);
  });

  test("throws ResourceNotFoundError when the organization is missing", async () => {
    vi.mocked(getOrganization).mockResolvedValue(null);
    await expect(getWorkspaceAuth(WORKSPACE_ID)).rejects.toThrow(ResourceNotFoundError);
  });

  test("throws AuthorizationError when the user has no org membership", async () => {
    vi.mocked(getMembershipByUserIdOrganizationId).mockResolvedValue(null);
    await expect(getWorkspaceAuth(WORKSPACE_ID)).rejects.toThrow(AuthorizationError);
  });

  // The core fix: an org member with no WorkspaceTeam grant for this workspace
  // must be rejected instead of being admitted (and mislabeled as a writer).
  test("throws AuthorizationError when the user has no workspace access", async () => {
    vi.mocked(hasUserWorkspaceAccess).mockResolvedValue(false);
    vi.mocked(getWorkspacePermissionByUserId).mockResolvedValue(null);
    await expect(getWorkspaceAuth(WORKSPACE_ID)).rejects.toThrow(AuthorizationError);
    expect(hasUserWorkspaceAccess).toHaveBeenCalledWith(USER_ID, WORKSPACE_ID);
  });

  test("marks a member with a read grant as read-only", async () => {
    vi.mocked(getWorkspacePermissionByUserId).mockResolvedValue("read");
    const auth = await getWorkspaceAuth(WORKSPACE_ID);
    expect(auth.isMember).toBe(true);
    expect(auth.hasReadAccess).toBe(true);
    expect(auth.isReadOnly).toBe(true);
  });

  test("does not mark a member with a readWrite grant as read-only", async () => {
    vi.mocked(getWorkspacePermissionByUserId).mockResolvedValue("readWrite");
    const auth = await getWorkspaceAuth(WORKSPACE_ID);
    expect(auth.hasReadWriteAccess).toBe(true);
    expect(auth.isReadOnly).toBe(false);
  });

  test("does not mark a member with a manage grant as read-only", async () => {
    vi.mocked(getWorkspacePermissionByUserId).mockResolvedValue("manage");
    const auth = await getWorkspaceAuth(WORKSPACE_ID);
    expect(auth.hasManageAccess).toBe(true);
    expect(auth.isReadOnly).toBe(false);
  });

  // Fail-safe: even if a member reaches the flags with no resolved permission,
  // isReadOnly must be true (most restricted), never false (writer).
  test("treats a member with no resolved permission as read-only (fail safe)", async () => {
    vi.mocked(getWorkspacePermissionByUserId).mockResolvedValue(null);
    const auth = await getWorkspaceAuth(WORKSPACE_ID);
    expect(auth.isMember).toBe(true);
    expect(auth.hasReadAccess).toBe(false);
    expect(auth.hasReadWriteAccess).toBe(false);
    expect(auth.hasManageAccess).toBe(false);
    expect(auth.isReadOnly).toBe(true);
  });

  test("does not mark an owner as read-only", async () => {
    vi.mocked(getMembershipByUserIdOrganizationId).mockResolvedValue(membershipWithRole("owner"));
    vi.mocked(getWorkspacePermissionByUserId).mockResolvedValue(null);
    const auth = await getWorkspaceAuth(WORKSPACE_ID);
    expect(auth.isOwner).toBe(true);
    expect(auth.isReadOnly).toBe(false);
  });

  test("returns the resolved workspace, organization, and session on success", async () => {
    const auth = await getWorkspaceAuth(WORKSPACE_ID);
    expect(auth.workspace).toBe(mockWorkspace);
    expect(auth.organization).toBe(mockOrganization);
    expect(auth.session).toBe(mockSession);
    expect(auth.workspacePermission).toBe("read");
  });
});
