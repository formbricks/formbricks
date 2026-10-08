import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { resetDb } from "@/integration/reset-db";
import { revokeUserSessionsExcept } from "@/modules/auth/lib/session-revocation";
import { sendMemberRetentionNoticeEmail } from "@/modules/email";
import { getRetentionClockCutoffs } from "../lib/schedule";
import { createMembersSweeper, deactivateDueMember, revokeCredentials } from "./members-sweeper";
import { openRetentionRun } from "./run";
import { runDataRetentionSweep } from "./sweep";

vi.mock("@/modules/email", () => ({ sendMemberRetentionNoticeEmail: vi.fn() }));
vi.mock("@/modules/auth/lib/session-revocation", () => ({ revokeUserSessionsExcept: vi.fn() }));
vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({
  queueAuditEventWithoutRequest: vi.fn().mockResolvedValue(undefined),
}));

const DAY = 24 * 60 * 60 * 1000;
const ago = (days: number) => new Date(Date.now() - days * DAY);
const WARN = 30;
const PERIOD = 365;

describe("members sweeper (real Postgres)", () => {
  let organizationId: string;

  const sweep = () =>
    runDataRetentionSweep({ checkLicence: async () => true, sweepers: { members: createMembersSweeper() } });

  const addMember = async (
    email: string,
    role: "owner" | "manager" | "member",
    { lastLoginAt, org = organizationId }: { lastLoginAt: Date | null; org?: string }
  ) => {
    const user = await prisma.user.create({ data: { name: email, email, lastLoginAt } });
    await prisma.membership.create({ data: { userId: user.id, organizationId: org, role, accepted: true } });
    return user.id;
  };

  const ageNotice = (userId: string, days: number) =>
    prisma.retentionNotice.update({
      where: { userId_organizationId_entity: { userId, organizationId, entity: "members" } },
      data: { sentAt: ago(days), deliveredAt: ago(days) },
    });

  const isActive = async (userId: string) =>
    (await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { isActive: true } })).isActive;

  beforeEach(async () => {
    vi.clearAllMocks();
    await resetDb();
    vi.mocked(sendMemberRetentionNoticeEmail).mockResolvedValue(true);
    vi.mocked(revokeUserSessionsExcept).mockResolvedValue(0);
    organizationId = (await prisma.organization.create({ data: { name: "Acme" } })).id;
    await prisma.retentionPolicy.create({
      data: {
        organizationId,
        entity: "members",
        enabled: true,
        enabledAt: ago(1000),
        warnDays: WARN,
        periodDays: PERIOD,
      },
    });
    await addMember("boss@example.com", "owner", { lastLoginAt: ago(1) });
  });

  test("warns the member, then deactivates them after the full warning and ends their access", async () => {
    const idle = await addMember("idle@example.com", "member", { lastLoginAt: ago(400) });
    await prisma.oauthClient.create({
      data: { clientId: "mcp-client", userId: idle, redirectUris: ["https://example.com/cb"] },
    });
    await prisma.oauthConsent.create({
      data: { userId: idle, clientId: "mcp-client", scopes: ["mcp"], createdAt: ago(1), updatedAt: ago(1) },
    });
    expect(await prisma.oauthConsent.count({ where: { userId: idle } })).toBe(1);

    await sweep();
    expect(sendMemberRetentionNoticeEmail).toHaveBeenCalledOnce();
    expect(sendMemberRetentionNoticeEmail).toHaveBeenCalledWith(
      expect.objectContaining({ email: "idle@example.com", organizationName: "Acme" })
    );
    expect(await isActive(idle)).toBe(true);

    await ageNotice(idle, WARN + 1);
    await sweep();

    expect(await isActive(idle)).toBe(false);
    expect(revokeUserSessionsExcept).toHaveBeenCalledWith({ userId: idle });
    expect(await prisma.oauthConsent.count({ where: { userId: idle } })).toBe(0);
    const items = await prisma.retentionRunItem.findMany({ orderBy: { run: { startedAt: "asc" } } });
    expect(items.map((item) => [item.action, item.targetName])).toEqual([
      ["notified", null],
      ["deactivated", null],
    ]);
  });

  test("a sign-in after the notice moves the clock: no deactivation", async () => {
    const idle = await addMember("idle@example.com", "member", { lastLoginAt: ago(400) });
    await sweep();
    await ageNotice(idle, WARN + 1);
    await prisma.user.update({ where: { id: idle }, data: { lastLoginAt: ago(0) } });

    await sweep();

    expect(await isActive(idle)).toBe(true);
  });

  test("counts a member who never signed in from when the policy took effect", async () => {
    const never = await addMember("never@example.com", "member", { lastLoginAt: null });

    await sweep();

    expect(sendMemberRetentionNoticeEmail).toHaveBeenCalledWith(
      expect.objectContaining({ email: "never@example.com" })
    );
    expect(await isActive(never)).toBe(true);
  });

  test("never acts on a member of another organisation, and never warns them", async () => {
    const otherOrg = (await prisma.organization.create({ data: { name: "Other" } })).id;
    const shared = await addMember("shared@example.com", "member", { lastLoginAt: ago(400) });
    await prisma.membership.create({
      data: { userId: shared, organizationId: otherOrg, role: "member", accepted: true },
    });

    await sweep();
    await sweep();

    expect(sendMemberRetentionNoticeEmail).not.toHaveBeenCalled();
    expect(await isActive(shared)).toBe(true);
    expect(await prisma.retentionRunItem.findMany()).toEqual([
      expect.objectContaining({ action: "skipped", skipReason: "otherOrganization", targetId: shared }),
    ]);
  });

  test("never deactivates the last active owner", async () => {
    await prisma.user.updateMany({ where: { email: "boss@example.com" }, data: { lastLoginAt: ago(400) } });
    const boss = (await prisma.user.findUniqueOrThrow({ where: { email: "boss@example.com" } })).id;
    await sweep();
    await ageNotice(boss, WARN + 1);

    await sweep();

    expect(await isActive(boss)).toBe(true);
    expect(await prisma.retentionRunItem.findFirst({ where: { action: "skipped" } })).toMatchObject({
      skipReason: "lastOwner",
    });
  });

  test("two owners due at once: exactly one is deactivated, so the organisation keeps an owner", async () => {
    await prisma.user.updateMany({ where: { email: "boss@example.com" }, data: { lastLoginAt: ago(400) } });
    const boss = (await prisma.user.findUniqueOrThrow({ where: { email: "boss@example.com" } })).id;
    const coOwner = await addMember("co@example.com", "owner", { lastLoginAt: ago(400) });
    await sweep();
    await ageNotice(boss, WARN + 1);
    await ageNotice(coOwner, WARN + 1);
    const run = (await openRetentionRun(organizationId, "members"))!;
    const { noticeDueAtOrBefore } = getRetentionClockCutoffs(run.policy, run.now);
    const context = { ...run, deadline: Date.now() + 60_000 };

    const outcomes = await Promise.all([
      deactivateDueMember(context, boss, noticeDueAtOrBefore),
      deactivateDueMember(context, coOwner, noticeDueAtOrBefore),
    ]);

    expect(outcomes.sort()).toEqual(["deactivated", "lastOwner"]);
    expect(
      await prisma.user.count({
        where: { isActive: true, email: { in: ["boss@example.com", "co@example.com"] } },
      })
    ).toBe(1);
  });

  test("re-checks under the lock that the member is still in this organisation alone", async () => {
    const idle = await addMember("idle@example.com", "member", { lastLoginAt: ago(400) });
    await sweep();
    await ageNotice(idle, WARN + 1);
    const run = (await openRetentionRun(organizationId, "members"))!;
    const { noticeDueAtOrBefore } = getRetentionClockCutoffs(run.policy, run.now);
    const otherOrg = (await prisma.organization.create({ data: { name: "Other" } })).id;
    await prisma.membership.create({
      data: { userId: idle, organizationId: otherOrg, role: "member", accepted: true },
    });

    await expect(
      deactivateDueMember({ ...run, deadline: Date.now() + 60_000 }, idle, noticeDueAtOrBefore)
    ).resolves.toBe("otherOrganization");
    expect(await isActive(idle)).toBe(true);
  });

  test("waits for another owner's deactivation in flight, then keeps the last owner", async () => {
    await prisma.user.updateMany({ where: { email: "boss@example.com" }, data: { lastLoginAt: ago(400) } });
    const boss = (await prisma.user.findUniqueOrThrow({ where: { email: "boss@example.com" } })).id;
    const coOwner = await addMember("co@example.com", "owner", { lastLoginAt: ago(400) });
    await sweep();
    await ageNotice(coOwner, WARN + 1);
    const run = (await openRetentionRun(organizationId, "members"))!;
    const { noticeDueAtOrBefore } = getRetentionClockCutoffs(run.policy, run.now);

    // Another sweep holds the owners' lock while it deactivates the other owner.
    let locked!: () => void;
    const lockTaken = new Promise<void>((resolve) => (locked = resolve));
    const other = prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 FROM "Membership" WHERE "organizationId" = ${organizationId} AND "role" = 'owner' FOR UPDATE`;
      await tx.user.update({ where: { id: boss }, data: { isActive: false } });
      locked();
      await new Promise((resolve) => setTimeout(resolve, 500));
    });
    await lockTaken;

    const outcome = await deactivateDueMember(
      { ...run, deadline: Date.now() + 60_000 },
      coOwner,
      noticeDueAtOrBefore
    );
    await other;

    expect(outcome).toBe("lastOwner");
    expect(await isActive(coOwner)).toBe(true);
  });

  test("leaves the sessions of a member reactivated before the revoke alone", async () => {
    const member = await addMember("back@example.com", "member", { lastLoginAt: ago(1) });

    await revokeCredentials(member);

    expect(revokeUserSessionsExcept).not.toHaveBeenCalled();
  });

  test("re-checks under the lock that the notice has run its full warning", async () => {
    const idle = await addMember("idle@example.com", "member", { lastLoginAt: ago(400) });
    await sweep();
    const run = (await openRetentionRun(organizationId, "members"))!;
    const { noticeDueAtOrBefore } = getRetentionClockCutoffs(run.policy, run.now);

    await expect(
      deactivateDueMember({ ...run, deadline: Date.now() + 60_000 }, idle, noticeDueAtOrBefore)
    ).resolves.toBeNull();
    expect(await isActive(idle)).toBe(true);
  });
});
