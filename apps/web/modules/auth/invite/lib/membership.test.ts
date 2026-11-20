import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { DatabaseError } from "@formbricks/types/errors";
import { reconcileOrganizationMembership } from "@/lib/authzed/organization-membership";
import { createTeamMembership } from "@/modules/auth/invite/lib/team";
import { acceptInviteMembership } from "./membership";

vi.mock("server-only", () => ({}));
vi.mock("@formbricks/database", () => ({
  prisma: { membership: { createMany: vi.fn(), findUnique: vi.fn() } },
}));
vi.mock("@/lib/authzed/organization-membership", () => ({ reconcileOrganizationMembership: vi.fn() }));
vi.mock("@/modules/auth/invite/lib/team", () => ({ createTeamMembership: vi.fn() }));

const invite = { organizationId: "org1", role: "member" as const, teamIds: ["team1"] };

describe("acceptInviteMembership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("creates the membership with the invite's role when the user is not a member yet", async () => {
    vi.mocked(prisma.membership.findUnique).mockResolvedValue({ role: "member" } as never);

    await acceptInviteMembership(invite, "user1");

    expect(prisma.membership.createMany).toHaveBeenCalledWith({
      data: [{ organizationId: "org1", userId: "user1", accepted: true, role: "member" }],
      skipDuplicates: true,
    });
    expect(reconcileOrganizationMembership).toHaveBeenCalledWith("org1", "user1");
    expect(createTeamMembership).toHaveBeenCalledWith(
      { organizationId: "org1", role: "member", teamIds: ["team1"] },
      "user1"
    );
  });

  // ENG-7097: a stale invite must not lower an existing member's role, an owner's included. The insert
  // is create-only, so this also holds when the owner row appears between any read and the write.
  test("keeps an existing owner's role and joins the invite's teams as owner", async () => {
    vi.mocked(prisma.membership.findUnique).mockResolvedValue({ role: "owner" } as never);

    await acceptInviteMembership(invite, "user1");

    expect(prisma.membership.createMany).toHaveBeenCalledWith(
      expect.objectContaining({ skipDuplicates: true })
    );
    expect(createTeamMembership).toHaveBeenCalledWith(
      { organizationId: "org1", role: "owner", teamIds: ["team1"] },
      "user1"
    );
  });

  test("reconciles an existing membership so a retry heals a missing relationship", async () => {
    vi.mocked(prisma.membership.findUnique).mockResolvedValue({ role: "owner" } as never);

    await acceptInviteMembership({ ...invite, teamIds: [] }, "user1");

    expect(reconcileOrganizationMembership).toHaveBeenCalledWith("org1", "user1");
  });

  test("wraps a known database error", async () => {
    vi.mocked(prisma.membership.createMany).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("boom", { code: "P2003", clientVersion: "test" })
    );

    await expect(acceptInviteMembership(invite, "user1")).rejects.toThrow(DatabaseError);
    expect(createTeamMembership).not.toHaveBeenCalled();
  });
});
