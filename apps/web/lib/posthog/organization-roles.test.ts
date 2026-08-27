import { beforeEach, describe, expect, test, vi } from "vitest";
import { TMembership } from "@formbricks/types/memberships";
import { getOrganizationRolePersonProperties } from "./organization-roles";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  getMembershipsByUserId: vi.fn(),
}));

vi.mock("@/lib/membership/service", () => ({
  getMembershipsByUserId: mocks.getMembershipsByUserId,
}));

describe("getOrganizationRolePersonProperties", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("maps every membership into the roles array, regardless of role", async () => {
    const memberships: TMembership[] = [
      { organizationId: "org_1", userId: "user_1", accepted: true, role: "owner" },
      { organizationId: "org_2", userId: "user_1", accepted: true, role: "member" },
      { organizationId: "org_3", userId: "user_1", accepted: true, role: "billing" },
    ];
    mocks.getMembershipsByUserId.mockResolvedValue(memberships);

    const result = await getOrganizationRolePersonProperties("user_1");

    expect(result).toEqual({
      organization_roles: [
        { organization_id: "org_1", role: "owner" },
        { organization_id: "org_2", role: "member" },
        { organization_id: "org_3", role: "billing" },
      ],
      organization_count: 3,
    });
  });

  test("returns an empty snapshot when the user has no memberships", async () => {
    mocks.getMembershipsByUserId.mockResolvedValue([]);

    const result = await getOrganizationRolePersonProperties("user_1");

    expect(result).toEqual({
      organization_roles: [],
      organization_count: 0,
    });
  });
});
