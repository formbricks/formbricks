import { getMembershipByUserIdOrganizationId } from "@/lib/membership/service";
import { getOrganization } from "@/lib/organization/service";
import { getServerSession } from "next-auth";
import { describe, expect, test, vi } from "vitest";
import { TMembership } from "@formbricks/types/memberships";
import { TOrganization } from "@formbricks/types/organizations";
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
vi.mock("@/modules/auth/lib/authOptions", () => ({
  authOptions: {},
}));
vi.mock("@/tolgee/server", () => ({
  getTranslate: vi.fn(() => Promise.resolve((k: string) => k)),
}));
vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));
vi.mock("react", () => ({ cache: (fn) => fn }));

describe("getOrganizationAuth", () => {
  const mockSession = { user: { id: "user-1" } };
  const mockOrg = { id: "org-1" } as TOrganization;
  const mockMembership: TMembership = {
    role: "member",
    organizationId: "org-1",
    userId: "user-1",
    accepted: true,
  };

  test("returns organization auth object on success", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(mockSession);

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
    vi.mocked(getServerSession).mockResolvedValueOnce(null);
    vi.mocked(getOrganization).mockResolvedValue(mockOrg);
    await expect(getOrganizationAuth("org-1")).rejects.toThrow("common.session_not_found");
  });

  test("throws if organization is missing", async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession);
    vi.mocked(getOrganization).mockResolvedValue(null);
    await expect(getOrganizationAuth("org-1")).rejects.toThrow("common.organization_not_found");
  });

  test("throws if membership is missing", async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession);
    vi.mocked(getOrganization).mockResolvedValue(mockOrg);
    vi.mocked(getMembershipByUserIdOrganizationId).mockResolvedValue(null);
    await expect(getOrganizationAuth("org-1")).rejects.toThrow("common.membership_not_found");
  });
});
