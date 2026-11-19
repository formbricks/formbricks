import { beforeEach, describe, expect, test, vi } from "vitest";
import { createMembership, getMembershipByUserIdOrganizationId } from "@/lib/membership/service";
import { createTeamMembership } from "@/modules/auth/invite/lib/team";
import { acceptInviteMembership } from "./membership";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/membership/service", () => ({
  createMembership: vi.fn(),
  getMembershipByUserIdOrganizationId: vi.fn(),
}));
vi.mock("@/modules/auth/invite/lib/team", () => ({ createTeamMembership: vi.fn() }));

const invite = { organizationId: "org1", role: "member" as const, teamIds: ["team1"] };

describe("acceptInviteMembership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("creates the membership with the invite's role when the user is not a member yet", async () => {
    vi.mocked(getMembershipByUserIdOrganizationId).mockResolvedValue(null);

    await acceptInviteMembership(invite, "user1");

    expect(createMembership).toHaveBeenCalledWith("org1", "user1", { accepted: true, role: "member" });
    expect(createTeamMembership).toHaveBeenCalledWith(
      { organizationId: "org1", role: "member", teamIds: ["team1"] },
      "user1"
    );
  });

  // ENG-7097: a stale invite must not lower an existing member's role, an owner's included.
  test("keeps an existing owner's role and joins the invite's teams as owner", async () => {
    vi.mocked(getMembershipByUserIdOrganizationId).mockResolvedValue({
      organizationId: "org1",
      userId: "user1",
      accepted: true,
      role: "owner",
    });

    await acceptInviteMembership(invite, "user1");

    expect(createMembership).not.toHaveBeenCalled();
    expect(createTeamMembership).toHaveBeenCalledWith(
      { organizationId: "org1", role: "owner", teamIds: ["team1"] },
      "user1"
    );
  });
});
