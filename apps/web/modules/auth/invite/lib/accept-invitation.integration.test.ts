import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { resetDb } from "@/integration/reset-db";
import { createInviteToken } from "@/lib/jwt";
import { getSession } from "@/modules/auth/lib/session";
import { acceptInvitation } from "./accept-invitation";

const settings = vi.hoisted(() => ({ enabled: true }));
vi.mock("@/lib/constants", async (original) => ({
  ...(await original<typeof import("@/lib/constants")>()),
  get AUDIT_LOG_ENABLED() {
    return settings.enabled;
  },
}));
vi.mock("@/modules/auth/lib/session", () => ({ getSession: vi.fn() }));
vi.mock("@/lib/authzed/organization-membership", () => ({ reconcileOrganizationMembership: vi.fn() }));
vi.mock("@/lib/authzed/team-workspace", () => ({ reconcileTeamWorkspaceRelationships: vi.fn() }));

beforeEach(async () => {
  vi.clearAllMocks();
  await resetDb();
  settings.enabled = true;
  vi.spyOn(logger, "audit").mockImplementation(() => {});
});
const fixture = async () => {
  const user = await prisma.user.create({ data: { name: "Private User", email: "invited@example.com" } });
  const organization = await prisma.organization.create({ data: { name: "Inviting organization" } });
  const team = await prisma.team.create({ data: { name: "Team", organizationId: organization.id } });
  const invite = await prisma.invite.create({
    data: {
      email: user.email,
      role: "member",
      organizationId: organization.id,
      creatorId: user.id,
      teamIds: [team.id],
      expiresAt: new Date(Date.now() + 60000),
    },
  });
  vi.mocked(getSession).mockResolvedValue({ user: { id: user.id } } as never);
  return { user, organization, team, invite, token: createInviteToken(invite.id, user.email) };
};

describe("invitation acceptance with real transaction and final audit payload", () => {
  test("commits the grant manifest once and denies replay without changing grants", async () => {
    const { user, organization, team, invite, token } = await fixture();
    expect(await acceptInvitation(token)).toMatchObject({ status: "accepted" });
    expect(await prisma.invite.findUnique({ where: { id: invite.id } })).toBeNull();
    expect(await prisma.membership.count()).toBe(1);
    expect(await prisma.teamUser.count()).toBe(1);
    expect(logger.audit).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: { id: user.id, type: "user" },
        target: { id: invite.id, type: "invite" },
        organizationId: organization.id,
        scope: "organization",
        status: "success",
        changes: expect.objectContaining({
          inviteConsumed: true,
          teamMemberships: [expect.objectContaining({ teamId: team.id })],
        }),
      })
    );
    expect(JSON.stringify(vi.mocked(logger.audit).mock.calls)).not.toMatch(/Private User|invited@example/);
    expect(JSON.stringify(vi.mocked(logger.audit).mock.calls)).not.toContain(token);
    expect(await acceptInvitation(token)).toMatchObject({ status: "not_found" });
    expect(logger.audit).toHaveBeenLastCalledWith(expect.objectContaining({ status: "denied" }));
    expect(await prisma.membership.count()).toBe(1);
  });
  test("an invite cannot grant a foreign organization's team and reports the skipped grant", async () => {
    const { token, invite, team } = await fixture();
    const foreign = await prisma.organization.create({ data: { name: "Other organization" } });
    const foreignTeam = await prisma.team.create({
      data: { name: "Other team", organizationId: foreign.id },
    });
    await prisma.invite.update({ where: { id: invite.id }, data: { teamIds: [team.id, foreignTeam.id] } });
    expect(await acceptInvitation(token)).toMatchObject({ status: "accepted" });
    expect(await prisma.teamUser.count({ where: { teamId: foreignTeam.id } })).toBe(0);
    expect(logger.audit).toHaveBeenLastCalledWith(
      expect.objectContaining({
        status: "partial",
        changes: expect.objectContaining({
          skippedTeamIds: [foreignTeam.id],
          teamMemberships: [expect.objectContaining({ teamId: team.id })],
        }),
      })
    );
  });
  test("wrong-account denial writes no grants", async () => {
    const { token } = await fixture();
    const other = await prisma.user.create({ data: { name: "Other", email: "other@example.com" } });
    vi.mocked(getSession).mockResolvedValue({ user: { id: other.id } } as never);
    expect(await acceptInvitation(token)).toMatchObject({ status: "email_mismatch" });
    expect(await prisma.membership.count()).toBe(0);
    expect(logger.audit).toHaveBeenLastCalledWith(
      expect.objectContaining({ actor: { id: other.id, type: "user" }, status: "denied" })
    );
  });
  test("a failed last write rolls back membership, team grants and invite consumption", async () => {
    const { token, invite } = await fixture();
    await prisma.$executeRawUnsafe(
      `CREATE FUNCTION eng3271_reject_update() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected write failure'; END $$`
    );
    await prisma.$executeRawUnsafe(
      `CREATE TRIGGER eng3271_reject_update BEFORE UPDATE ON "User" FOR EACH ROW EXECUTE FUNCTION eng3271_reject_update()`
    );
    try {
      await expect(acceptInvitation(token)).rejects.toThrow();
      expect(await prisma.membership.count()).toBe(0);
      expect(await prisma.teamUser.count()).toBe(0);
      expect(await prisma.invite.findUnique({ where: { id: invite.id } })).not.toBeNull();
      expect(logger.audit).toHaveBeenLastCalledWith(expect.objectContaining({ status: "failure" }));
    } finally {
      await prisma.$executeRawUnsafe(`DROP TRIGGER eng3271_reject_update ON "User"`);
      await prisma.$executeRawUnsafe(`DROP FUNCTION eng3271_reject_update()`);
    }
  });
  test("disabled auditing and sink failure preserve acceptance", async () => {
    const { token } = await fixture();
    settings.enabled = false;
    expect(await acceptInvitation(token)).toMatchObject({ status: "accepted" });
    expect(logger.audit).not.toHaveBeenCalled();
    await resetDb();
    const next = await fixture();
    settings.enabled = true;
    vi.mocked(logger.audit).mockImplementation(() => {
      throw new Error("sink failed");
    });
    expect(await acceptInvitation(next.token)).toMatchObject({ status: "accepted" });
    expect(await prisma.membership.count()).toBe(1);
  });
});
