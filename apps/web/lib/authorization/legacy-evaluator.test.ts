import { beforeEach, describe, expect, test, vi } from "vitest";
import type { TAuthenticationApiKey } from "@formbricks/types/auth";
import { DatabaseError } from "@formbricks/types/errors";
import type { TMembership } from "@formbricks/types/memberships";
import { USER_MANAGEMENT_MINIMUM_ROLE } from "@/lib/constants";
import { getMembershipByUserIdOrganizationId } from "@/lib/membership/service";
import { getUserManagementAccess } from "@/lib/membership/utils";
import { getTeamRoleByTeamIdUserId } from "@/modules/ee/teams/lib/roles";
import { AUTHORIZATION_PERMISSION_MAP, type TAuthorizationActor } from "./contract";
import { legacyEvaluator } from "./legacy-evaluator";
import { hasUserWorkspaceAccessForActionLegacy } from "./legacy-workspace-access";
import {
  getApiKeyAuthById,
  getApiKeyOrganizationId,
  getDashboardWorkspaceId,
  getFeedbackDirectoryAssignmentAuthorizationScope,
  getFeedbackDirectoryAuthorizationScope,
  getResponseSurveyId,
  getSurveyWorkspaceId,
  getTeamOrganizationId,
} from "./resolvers";

vi.mock("./legacy-workspace-access", () => ({ hasUserWorkspaceAccessForActionLegacy: vi.fn() }));
vi.mock("@/lib/membership/service", () => ({ getMembershipByUserIdOrganizationId: vi.fn() }));
vi.mock("@/modules/ee/teams/lib/roles", () => ({ getTeamRoleByTeamIdUserId: vi.fn() }));
// The evaluator only reads USER_MANAGEMENT_MINIMUM_ROLE from constants; stub the module
// so the env-heavy real constants file doesn't load under Vitest.
vi.mock("@/lib/constants", () => ({ USER_MANAGEMENT_MINIMUM_ROLE: "manager" }));
// Keep getAccessFlags real; spy the configurable user-management floor.
vi.mock("@/lib/membership/utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/membership/utils")>()),
  getUserManagementAccess: vi.fn(),
}));
vi.mock("./resolvers", () => ({
  getApiKeyAuthById: vi.fn(),
  getApiKeyOrganizationId: vi.fn(),
  getDashboardWorkspaceId: vi.fn(),
  getFeedbackDirectoryAssignmentAuthorizationScope: vi.fn(),
  getFeedbackDirectoryAuthorizationScope: vi.fn(),
  getResponseSurveyId: vi.fn(),
  getSurveyWorkspaceId: vi.fn(),
  getTeamOrganizationId: vi.fn(),
}));

const USER: TAuthorizationActor = { type: "user", id: "user1" };
const API_KEY: TAuthorizationActor = { type: "apiKey", id: "key1" };
const { can } = legacyEvaluator;

const membership = (role: TMembership["role"]): TMembership => ({ role }) as TMembership;

const apiKeyAuth = (over: Partial<TAuthenticationApiKey> = {}): TAuthenticationApiKey => ({
  type: "apiKey",
  apiKeyId: "key1",
  organizationId: "org1",
  organizationAccess: { accessControl: { read: false, write: false } },
  workspacePermissions: [],
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  // Default the user-management floor to deny; individual tests opt in.
  vi.mocked(getUserManagementAccess).mockReturnValue(false);
});

describe("legacyEvaluator — workspace-derived resources (user)", () => {
  test("survey read/write/manage map to the GET/POST/DELETE workspace gates", async () => {
    vi.mocked(getSurveyWorkspaceId).mockResolvedValue("ws1");
    vi.mocked(hasUserWorkspaceAccessForActionLegacy).mockResolvedValue(true);

    await can(USER, "survey.read", { type: "survey", id: "s1" });
    expect(hasUserWorkspaceAccessForActionLegacy).toHaveBeenLastCalledWith("user1", "ws1", "GET");

    await can(USER, "survey.write", { type: "survey", id: "s1" });
    expect(hasUserWorkspaceAccessForActionLegacy).toHaveBeenLastCalledWith("user1", "ws1", "POST");

    await can(USER, "survey.manage", { type: "survey", id: "s1" });
    expect(hasUserWorkspaceAccessForActionLegacy).toHaveBeenLastCalledWith("user1", "ws1", "DELETE");
  });

  test("survey delete uses the readWrite gate, response export uses the read gate", async () => {
    vi.mocked(getSurveyWorkspaceId).mockResolvedValue("ws1");
    vi.mocked(getResponseSurveyId).mockResolvedValue("s1");
    vi.mocked(hasUserWorkspaceAccessForActionLegacy).mockResolvedValue(true);

    await can(USER, "survey.delete", { type: "survey", id: "s1" });
    expect(hasUserWorkspaceAccessForActionLegacy).toHaveBeenLastCalledWith("user1", "ws1", "POST");

    await can(USER, "response.export", { type: "response", id: "r1" });
    expect(hasUserWorkspaceAccessForActionLegacy).toHaveBeenLastCalledWith("user1", "ws1", "GET");
  });

  test("returns false when the resource does not resolve to a workspace", async () => {
    vi.mocked(getSurveyWorkspaceId).mockResolvedValue(null);
    await expect(can(USER, "survey.read", { type: "survey", id: "missing" })).resolves.toBe(false);
    expect(hasUserWorkspaceAccessForActionLegacy).not.toHaveBeenCalled();
  });

  test("propagates operational failures instead of denying", async () => {
    vi.mocked(getSurveyWorkspaceId).mockResolvedValue("ws1");
    vi.mocked(hasUserWorkspaceAccessForActionLegacy).mockRejectedValue(new DatabaseError("db down"));
    await expect(can(USER, "survey.read", { type: "survey", id: "s1" })).rejects.toBeInstanceOf(
      DatabaseError
    );
  });
});

describe("legacyEvaluator — workspace-derived resources (API key)", () => {
  test("a write-scoped key can write and read its workspace but not manage it", async () => {
    vi.mocked(getSurveyWorkspaceId).mockResolvedValue("ws1");
    vi.mocked(getApiKeyAuthById).mockResolvedValue(
      apiKeyAuth({ workspacePermissions: [{ workspaceId: "ws1", workspaceName: "W", permission: "write" }] })
    );

    await expect(can(API_KEY, "survey.read", { type: "survey", id: "s1" })).resolves.toBe(true);
    await expect(can(API_KEY, "survey.write", { type: "survey", id: "s1" })).resolves.toBe(true);
    await expect(can(API_KEY, "survey.manage", { type: "survey", id: "s1" })).resolves.toBe(false);
  });

  test("a key with no grant on the workspace is denied", async () => {
    vi.mocked(getSurveyWorkspaceId).mockResolvedValue("ws1");
    vi.mocked(getApiKeyAuthById).mockResolvedValue(apiKeyAuth({ workspacePermissions: [] }));
    await expect(can(API_KEY, "survey.read", { type: "survey", id: "s1" })).resolves.toBe(false);
  });
});

describe("legacyEvaluator — organization roles", () => {
  test("owner has write/manage/billing; manager has manage/billing but not write", async () => {
    vi.mocked(getMembershipByUserIdOrganizationId).mockResolvedValue(membership("owner"));
    await expect(can(USER, "organization.write", { type: "organization", id: "org1" })).resolves.toBe(true);
    await expect(can(USER, "organization.manage", { type: "organization", id: "org1" })).resolves.toBe(true);

    vi.mocked(getMembershipByUserIdOrganizationId).mockResolvedValue(membership("manager"));
    await expect(can(USER, "organization.write", { type: "organization", id: "org1" })).resolves.toBe(false);
    await expect(can(USER, "organization.manage", { type: "organization", id: "org1" })).resolves.toBe(true);
    await expect(
      can(USER, "organization.manage_api_keys", { type: "organization", id: "org1" })
    ).resolves.toBe(true);
  });

  test("billing role keeps billing access but no product/access management (regression guard)", async () => {
    vi.mocked(getMembershipByUserIdOrganizationId).mockResolvedValue(membership("billing"));
    await expect(
      can(USER, "organization.manage_billing", { type: "organization", id: "org1" })
    ).resolves.toBe(true);
    await expect(can(USER, "organization.read", { type: "organization", id: "org1" })).resolves.toBe(true);
    await expect(can(USER, "organization.read_access", { type: "organization", id: "org1" })).resolves.toBe(
      false
    );
    await expect(can(USER, "organization.manage", { type: "organization", id: "org1" })).resolves.toBe(false);
  });

  test("plain member sees the org and its access lists but manages nothing; a non-member is denied read", async () => {
    vi.mocked(getMembershipByUserIdOrganizationId).mockResolvedValue(membership("member"));
    await expect(can(USER, "organization.read", { type: "organization", id: "org1" })).resolves.toBe(true);
    await expect(can(USER, "organization.read_access", { type: "organization", id: "org1" })).resolves.toBe(
      true
    );
    await expect(can(USER, "organization.manage_access", { type: "organization", id: "org1" })).resolves.toBe(
      false
    );

    vi.mocked(getMembershipByUserIdOrganizationId).mockResolvedValue(null);
    await expect(can(USER, "organization.read", { type: "organization", id: "org1" })).resolves.toBe(false);
  });

  test("manage_access honors the configurable USER_MANAGEMENT_MINIMUM_ROLE floor, not a hardcoded owner/manager check", async () => {
    vi.mocked(getMembershipByUserIdOrganizationId).mockResolvedValue(membership("manager"));

    // The floor can deny even a manager (e.g. USER_MANAGEMENT_MINIMUM_ROLE="owner" or "disabled").
    vi.mocked(getUserManagementAccess).mockReturnValue(false);
    await expect(can(USER, "organization.manage_access", { type: "organization", id: "org1" })).resolves.toBe(
      false
    );
    expect(getUserManagementAccess).toHaveBeenCalledWith("manager", USER_MANAGEMENT_MINIMUM_ROLE);

    // …and grants when the floor allows it.
    vi.mocked(getUserManagementAccess).mockReturnValue(true);
    await expect(can(USER, "organization.manage_access", { type: "organization", id: "org1" })).resolves.toBe(
      true
    );

    // A non-member never reaches the floor.
    vi.mocked(getMembershipByUserIdOrganizationId).mockResolvedValue(null);
    vi.mocked(getUserManagementAccess).mockReturnValue(true);
    await expect(can(USER, "organization.manage_access", { type: "organization", id: "org1" })).resolves.toBe(
      false
    );
  });

  test("an org-scoped API key uses its access-control rights, never user-only permissions", async () => {
    vi.mocked(getApiKeyAuthById).mockResolvedValue(
      apiKeyAuth({ organizationAccess: { accessControl: { read: true, write: true } } })
    );
    await expect(can(API_KEY, "organization.read", { type: "organization", id: "org1" })).resolves.toBe(true);
    await expect(
      can(API_KEY, "organization.manage_access", { type: "organization", id: "org1" })
    ).resolves.toBe(true);
    await expect(can(API_KEY, "organization.manage", { type: "organization", id: "org1" })).resolves.toBe(
      false
    );

    // A key from a different organization is denied.
    vi.mocked(getApiKeyAuthById).mockResolvedValue(apiKeyAuth({ organizationId: "other" }));
    await expect(can(API_KEY, "organization.read", { type: "organization", id: "org1" })).resolves.toBe(
      false
    );
  });
});

describe("legacyEvaluator — teams", () => {
  beforeEach(() => {
    vi.mocked(getTeamOrganizationId).mockResolvedValue("org1");
  });

  test("a teamless org member can read a team but not manage it", async () => {
    vi.mocked(getMembershipByUserIdOrganizationId).mockResolvedValue(membership("member"));
    vi.mocked(getTeamRoleByTeamIdUserId).mockResolvedValue(null);
    await expect(can(USER, "team.read", { type: "team", id: "t1" })).resolves.toBe(true);
    await expect(can(USER, "team.manage", { type: "team", id: "t1" })).resolves.toBe(false);
  });

  test("a team admin manages the team, but only owners/managers delete it", async () => {
    vi.mocked(getMembershipByUserIdOrganizationId).mockResolvedValue(membership("member"));
    vi.mocked(getTeamRoleByTeamIdUserId).mockResolvedValue("admin");
    await expect(can(USER, "team.manage", { type: "team", id: "t1" })).resolves.toBe(true);
    await expect(can(USER, "team.delete", { type: "team", id: "t1" })).resolves.toBe(false);

    vi.mocked(getMembershipByUserIdOrganizationId).mockResolvedValue(membership("owner"));
    await expect(can(USER, "team.delete", { type: "team", id: "t1" })).resolves.toBe(true);
  });

  test("an org access-control API key reads/manages/deletes teams in its own org only", async () => {
    vi.mocked(getApiKeyAuthById).mockResolvedValue(
      apiKeyAuth({ organizationAccess: { accessControl: { read: true, write: true } } })
    );
    await expect(can(API_KEY, "team.read", { type: "team", id: "t1" })).resolves.toBe(true);
    await expect(can(API_KEY, "team.manage", { type: "team", id: "t1" })).resolves.toBe(true);
    await expect(can(API_KEY, "team.delete", { type: "team", id: "t1" })).resolves.toBe(true);

    // read-only access control can read but not manage/delete
    vi.mocked(getApiKeyAuthById).mockResolvedValue(
      apiKeyAuth({ organizationAccess: { accessControl: { read: true, write: false } } })
    );
    await expect(can(API_KEY, "team.manage", { type: "team", id: "t1" })).resolves.toBe(false);

    // a key from another org is denied
    vi.mocked(getApiKeyAuthById).mockResolvedValue(apiKeyAuth({ organizationId: "other" }));
    await expect(can(API_KEY, "team.read", { type: "team", id: "t1" })).resolves.toBe(false);
  });
});

describe("legacyEvaluator — API key as a resource", () => {
  test("only org owners/managers may read or manage an API key; keys cannot", async () => {
    vi.mocked(getApiKeyOrganizationId).mockResolvedValue("org1");

    vi.mocked(getMembershipByUserIdOrganizationId).mockResolvedValue(membership("owner"));
    await expect(can(USER, "apiKey.read", { type: "apiKey", id: "k9" })).resolves.toBe(true);
    await expect(can(USER, "apiKey.manage", { type: "apiKey", id: "k9" })).resolves.toBe(true);

    vi.mocked(getMembershipByUserIdOrganizationId).mockResolvedValue(membership("member"));
    await expect(can(USER, "apiKey.read", { type: "apiKey", id: "k9" })).resolves.toBe(false);

    await expect(can(API_KEY, "apiKey.read", { type: "apiKey", id: "k9" })).resolves.toBe(false);
  });
});

describe("legacyEvaluator — feedback datasets", () => {
  test("owners and managers administer a directory without a workspace assignment", async () => {
    vi.mocked(getFeedbackDirectoryAuthorizationScope).mockResolvedValue({
      isArchived: false,
      organizationId: "org1",
      workspaceIds: [],
    });
    vi.mocked(getMembershipByUserIdOrganizationId).mockResolvedValue(membership("manager"));

    await expect(
      can(USER, "feedbackDirectory.manage", { type: "feedbackDirectory", id: "directory-1" })
    ).resolves.toBe(true);
  });

  test("uses the union of active workspace grants for a directory-wide decision", async () => {
    vi.mocked(getFeedbackDirectoryAuthorizationScope).mockResolvedValue({
      isArchived: false,
      organizationId: "org1",
      workspaceIds: ["workspace-a", "workspace-b"],
    });
    vi.mocked(getMembershipByUserIdOrganizationId).mockResolvedValue(membership("member"));
    vi.mocked(hasUserWorkspaceAccessForActionLegacy).mockResolvedValueOnce(false).mockResolvedValueOnce(true);

    await expect(
      can(USER, "feedbackDirectory.read", { type: "feedbackDirectory", id: "directory-1" })
    ).resolves.toBe(true);
    expect(hasUserWorkspaceAccessForActionLegacy).toHaveBeenNthCalledWith(1, "user1", "workspace-a", "GET");
    expect(hasUserWorkspaceAccessForActionLegacy).toHaveBeenNthCalledWith(2, "user1", "workspace-b", "GET");
  });

  test("checks only the exact workspace carried by an assignment resource", async () => {
    vi.mocked(getFeedbackDirectoryAssignmentAuthorizationScope).mockResolvedValue({
      assignmentId: "fdwa-1",
      organizationId: "org1",
      workspaceId: "workspace-a",
    });
    vi.mocked(getMembershipByUserIdOrganizationId).mockResolvedValue(membership("member"));
    vi.mocked(hasUserWorkspaceAccessForActionLegacy).mockResolvedValue(false);

    await expect(
      can(USER, "feedbackDirectoryAssignment.write", {
        type: "feedbackDirectoryAssignment",
        id: "directory-1",
        workspaceId: "workspace-a",
      })
    ).resolves.toBe(false);
    expect(hasUserWorkspaceAccessForActionLegacy).toHaveBeenCalledOnce();
    expect(hasUserWorkspaceAccessForActionLegacy).toHaveBeenCalledWith("user1", "workspace-a", "POST");
  });

  test("denies archived, missing, and cross-organization assignments through the resolver", async () => {
    vi.mocked(getFeedbackDirectoryAuthorizationScope).mockResolvedValue({
      isArchived: true,
      organizationId: "org1",
      workspaceIds: ["workspace-a"],
    });
    vi.mocked(getFeedbackDirectoryAssignmentAuthorizationScope).mockResolvedValue(null);

    await expect(
      can(USER, "feedbackDirectory.read", { type: "feedbackDirectory", id: "directory-1" })
    ).resolves.toBe(false);
    await expect(
      can(USER, "feedbackDirectoryAssignment.read", {
        type: "feedbackDirectoryAssignment",
        id: "directory-1",
        workspaceId: "workspace-a",
      })
    ).resolves.toBe(false);
    expect(hasUserWorkspaceAccessForActionLegacy).not.toHaveBeenCalled();
  });
});

describe("legacyEvaluator — hardening", () => {
  // A loose alias to exercise inputs the public generic would reject at compile time
  // (unknown actor discriminants, out-of-vocabulary actions) — i.e. runtime type-bypass.
  const canLoose = can as (
    actor: { type: string; id: string },
    action: string,
    resource: { type: string; id: string }
  ) => Promise<boolean>;

  test("every workspace-scoped action is mapped to a workspace gate", async () => {
    vi.mocked(getSurveyWorkspaceId).mockResolvedValue("ws1");
    vi.mocked(getDashboardWorkspaceId).mockResolvedValue("ws1");
    vi.mocked(getResponseSurveyId).mockResolvedValue("s1");
    vi.mocked(hasUserWorkspaceAccessForActionLegacy).mockResolvedValue(true);

    for (const type of ["workspace", "survey", "dashboard", "response"] as const) {
      for (const permission of AUTHORIZATION_PERMISSION_MAP[type]) {
        // An unmapped action falls through to `false`; requiring `true` when the gate
        // allows keeps WORKSPACE_ACTION_LEVEL exhaustive as the vocabulary grows.
        await expect(canLoose(USER, `${type}.${permission}`, { type, id: "x" })).resolves.toBe(true);
      }
    }
  });

  test("rejects a mismatched action/resource pair instead of denying", async () => {
    await expect(canLoose(USER, "organization.read", { type: "survey", id: "s1" })).rejects.toThrow(
      /does not match resource type/
    );
  });

  test("rejects an unknown actor type instead of treating it as an API key", async () => {
    vi.mocked(getTeamOrganizationId).mockResolvedValue("org1");
    const rogue = { type: "system", id: "sys1" };

    await expect(canLoose(rogue, "workspace.read", { type: "workspace", id: "w1" })).rejects.toThrow(
      /Unsupported authorization actor/
    );
    await expect(canLoose(rogue, "organization.read", { type: "organization", id: "org1" })).rejects.toThrow(
      /Unsupported authorization actor/
    );
    await expect(canLoose(rogue, "team.read", { type: "team", id: "t1" })).rejects.toThrow(
      /Unsupported authorization actor/
    );
    await expect(canLoose(rogue, "apiKey.read", { type: "apiKey", id: "k1" })).rejects.toThrow(
      /Unsupported authorization actor/
    );
  });

  test("rejects an action outside the vocabulary before dispatch", async () => {
    await expect(canLoose(USER, "apiKey.delete", { type: "apiKey", id: "k1" })).rejects.toThrow(
      /Unknown authorization action/
    );
    await expect(canLoose(USER, "survey.frobnicate", { type: "survey", id: "s1" })).rejects.toThrow(
      /Unknown authorization action/
    );
  });
});

describe("legacyEvaluator — revoked or deleted API keys", () => {
  // The evaluator resolves the key's scopes from storage on every decision, so a key that
  // has been revoked or deleted since it authenticated can no longer authorize anything.
  test("a key that no longer exists cannot authorize any resource", async () => {
    vi.mocked(getApiKeyAuthById).mockResolvedValue(null);
    vi.mocked(getSurveyWorkspaceId).mockResolvedValue("ws1");
    vi.mocked(getTeamOrganizationId).mockResolvedValue("org1");

    await expect(can(API_KEY, "workspace.read", { type: "workspace", id: "ws1" })).resolves.toBe(false);
    await expect(can(API_KEY, "survey.read", { type: "survey", id: "s1" })).resolves.toBe(false);
    await expect(can(API_KEY, "organization.read", { type: "organization", id: "org1" })).resolves.toBe(
      false
    );
    await expect(can(API_KEY, "team.read", { type: "team", id: "t1" })).resolves.toBe(false);
  });

  test("a key scoped to another organization cannot authorize this one", async () => {
    vi.mocked(getApiKeyAuthById).mockResolvedValue(apiKeyAuth({ organizationId: "other-org" }));
    vi.mocked(getTeamOrganizationId).mockResolvedValue("org1");

    await expect(can(API_KEY, "organization.read", { type: "organization", id: "org1" })).resolves.toBe(
      false
    );
    await expect(can(API_KEY, "team.read", { type: "team", id: "t1" })).resolves.toBe(false);
  });
});
