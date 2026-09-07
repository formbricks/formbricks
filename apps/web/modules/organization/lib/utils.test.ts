import { beforeEach, describe, expect, test, vi } from "vitest";
import { AuthenticationError, ResourceNotFoundError } from "@formbricks/types/errors";
import { TMembership } from "@formbricks/types/memberships";
import { TOrganization } from "@formbricks/types/organizations";
import { can } from "@/lib/authorization";
import { getMembershipByUserIdOrganizationId } from "@/lib/membership/service";
import { getOrganization } from "@/lib/organization/service";
import { getSession } from "@/modules/auth/lib/session";
import { getOrganizationAuth } from "./utils";

vi.mock("@/lib/membership/service", () => ({
  getMembershipByUserIdOrganizationId: vi.fn(),
}));
vi.mock("@/lib/membership/utils", () => ({
  getAccessFlags: vi.fn(() => ({
    isMember: true,
    isOwner: false,
    isManager: false,
    isBilling: false,
  })),
}));
vi.mock("@/lib/organization/service", () => ({
  getOrganization: vi.fn(),
}));
vi.mock("@/lingodotdev/server", () => ({
  getTranslate: vi.fn(() => Promise.resolve((k: string) => k)),
}));
vi.mock("@/modules/auth/lib/session", () => ({
  getSession: vi.fn(),
}));
vi.mock("react", () => ({ cache: (fn: Function) => fn }));
// ENG-2409: the tenancy gate now asks `can(organization.read)`. Mocked rather than left real so the
// two arms of the throw can be driven independently — under the legacy evaluator they are the same
// condition (`read` is granted to exactly the roles that have a membership row), so with the real
// evaluator a deleted `can()` call would still throw via the membership arm and no test would fail.
vi.mock("@/lib/authorization", () => ({ can: vi.fn() }));
vi.mock("@/lib/authorization/context", () => ({
  withAuthorizationSurface: (_surface: string, callback: () => unknown) => callback(),
}));

describe("getOrganizationAuth", () => {
  beforeEach(() => {
    vi.mocked(can).mockResolvedValue(true);
  });

  const mockSession = { user: { id: "user-1" }, expires: new Date().toISOString() };
  const mockOrg = { id: "org-1" } as TOrganization;
  const mockMembership: TMembership = {
    role: "member",
    organizationId: "org-1",
    userId: "user-1",
    accepted: true,
  };

  test("returns organization auth object on success", async () => {
    vi.mocked(getSession).mockResolvedValueOnce(mockSession);

    vi.mocked(getOrganization).mockResolvedValue(mockOrg);
    vi.mocked(getMembershipByUserIdOrganizationId).mockResolvedValue(mockMembership);
    const result = await getOrganizationAuth("org-1");
    expect(result.organization).toBe(mockOrg);
    expect(result.session).toBe(mockSession);
    expect(result.currentUserMembership).toBe(mockMembership);
    expect(result.isMember).toBe(true);
    expect(result.isOwner).toBe(false);
    expect(result.isManager).toBe(false);
    expect(result.isBilling).toBe(false);
  });

  test("throws if session is missing", async () => {
    vi.mocked(getSession).mockResolvedValueOnce(null);
    vi.mocked(getOrganization).mockResolvedValue(mockOrg);
    await expect(getOrganizationAuth("org-1")).rejects.toThrow(AuthenticationError);
  });

  test("throws if organization is missing", async () => {
    vi.mocked(getSession).mockResolvedValue(mockSession);
    vi.mocked(getOrganization).mockResolvedValue(null);
    await expect(getOrganizationAuth("org-1")).rejects.toThrow(ResourceNotFoundError);
  });

  test("throws if membership is missing", async () => {
    vi.mocked(getSession).mockResolvedValue(mockSession);
    vi.mocked(getOrganization).mockResolvedValue(mockOrg);
    vi.mocked(getMembershipByUserIdOrganizationId).mockResolvedValue(null);
    await expect(getOrganizationAuth("org-1")).rejects.toThrow(ResourceNotFoundError);
  });

  // ENG-2409: the gate half of that throw, isolated. Unreachable under the legacy evaluator, where
  // `organization.read` and "has a membership row" are the same condition — but reachable under
  // SpiceDB enforcement if projection drifts, and this is what proves the decision now actually
  // depends on `can()` rather than on the row.
  test("throws when authorization denies even though a membership row exists", async () => {
    vi.mocked(getSession).mockResolvedValue(mockSession);
    vi.mocked(getOrganization).mockResolvedValue(mockOrg);
    vi.mocked(getMembershipByUserIdOrganizationId).mockResolvedValue(mockMembership);
    vi.mocked(can).mockResolvedValue(false);

    await expect(getOrganizationAuth("org-1")).rejects.toThrow(ResourceNotFoundError);
  });

  test("asks the central interface for organization.read on the acting user", async () => {
    vi.mocked(getSession).mockResolvedValue(mockSession);
    vi.mocked(getOrganization).mockResolvedValue(mockOrg);
    vi.mocked(getMembershipByUserIdOrganizationId).mockResolvedValue(mockMembership);

    await getOrganizationAuth("org-1");

    expect(can).toHaveBeenCalledExactlyOnceWith({ type: "user", id: "user-1" }, "organization.read", {
      type: "organization",
      id: "org-1",
    });
  });
});
