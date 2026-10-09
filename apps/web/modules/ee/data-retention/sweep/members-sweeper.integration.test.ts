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

/**
 * Better Auth's own session calls, so its database hooks run exactly as they do for a request: a
 * sign-in creates a session, a request on a day-old session renews it, a sign-out deletes it.
 */
const betterAuthSessions = async () => {
  const { auth } = await import("@/modules/auth/lib/auth");
  return (await auth.$context).internalAdapter;
};
const startSession = async (userId: string) =>
  (await (await betterAuthSessions()).createSession(userId)).token;
const renewSession = async (token: string) =>
  (await betterAuthSessions()).updateSession(token, {
    expiresAt: new Date(Date.now() + 7 * DAY),
    updatedAt: new Date(),
  });
const signOut = async (token: string) => (await betterAuthSessions()).deleteSession(token);

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
    await prisma.user.update({ where: { id: idle }, data: { locale: "de-DE" } });
    await prisma.oauthClient.create({
      data: { clientId: "mcp-client", userId: idle, redirectUris: ["https://example.com/cb"] },
    });
    await prisma.oauthConsent.create({
      data: { userId: idle, clientId: "mcp-client", scopes: ["mcp"], createdAt: ago(1), updatedAt: ago(1) },
    });
    expect(await prisma.oauthConsent.count({ where: { userId: idle } })).toBe(1);
    await prisma.oauthRefreshToken.create({
      data: {
        token: "refresh-token",
        clientId: "mcp-client",
        userId: idle,
        scopes: ["mcp"],
        expiresAt: ago(-30),
        createdAt: ago(1),
      },
    });

    await sweep();
    expect(sendMemberRetentionNoticeEmail).toHaveBeenCalledOnce();
    expect(sendMemberRetentionNoticeEmail).toHaveBeenCalledWith(
      expect.objectContaining({ email: "idle@example.com", organizationName: "Acme", locale: "de-DE" })
    );
    expect(await isActive(idle)).toBe(true);

    await ageNotice(idle, WARN + 1);
    await sweep();

    expect(await isActive(idle)).toBe(false);
    expect(revokeUserSessionsExcept).toHaveBeenCalledWith({ userId: idle });
    expect(await prisma.oauthConsent.count({ where: { userId: idle } })).toBe(0);
    expect(await prisma.oauthRefreshToken.findFirstOrThrow({ where: { userId: idle } })).toMatchObject({
      revoked: expect.any(Date),
    });
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

  test("a member who stays signed in is active: recorded activity moves the clock", async () => {
    const signedIn = await addMember("signed-in@example.com", "member", { lastLoginAt: ago(400) });
    await prisma.user.update({ where: { id: signedIn }, data: { lastActiveAt: ago(1) } });

    await sweep();

    expect(sendMemberRetentionNoticeEmail).not.toHaveBeenCalled();
    expect(await isActive(signedIn)).toBe(true);
  });

  test("a session renewal voids the notice, and signing out afterwards doesn't bring it back", async () => {
    const idle = await addMember("idle@example.com", "member", { lastLoginAt: ago(400) });
    // A session from long ago, still alive: nothing recorded since the sign-in.
    const token = await startSession(idle);
    await prisma.user.update({ where: { id: idle }, data: { lastActiveAt: null } });
    await sweep();
    expect(sendMemberRetentionNoticeEmail).toHaveBeenCalledOnce();
    await ageNotice(idle, WARN + 1);

    // They come back: Better Auth renews the session (its update hook records the activity), then
    // they sign out, which deletes the session row and, with it, Better Auth's own record of it.
    await renewSession(token);
    const { lastActiveAt } = await prisma.user.findUniqueOrThrow({ where: { id: idle } });
    expect(Date.now() - lastActiveAt!.getTime()).toBeLessThan(60_000);
    await signOut(token);
    expect(await prisma.session.count({ where: { userId: idle } })).toBe(0);

    await sweep();

    expect(await isActive(idle)).toBe(true);
    expect(sendMemberRetentionNoticeEmail).toHaveBeenCalledOnce();
    expect((await prisma.user.findUniqueOrThrow({ where: { id: idle } })).lastActiveAt).toEqual(lastActiveAt);
  });

  test("a sign-in records activity too, so the member isn't warned", async () => {
    const member = await addMember("member@example.com", "member", { lastLoginAt: ago(400) });

    await startSession(member);
    const { lastActiveAt } = await prisma.user.findUniqueOrThrow({ where: { id: member } });
    expect(Date.now() - lastActiveAt!.getTime()).toBeLessThan(60_000);

    await sweep();
    expect(sendMemberRetentionNoticeEmail).not.toHaveBeenCalled();
  });

  test("a session renewed after the notice was delivered stops the deactivation under the lock", async () => {
    const idle = await addMember("idle@example.com", "member", { lastLoginAt: ago(400) });
    const token = await startSession(idle);
    await prisma.user.update({ where: { id: idle }, data: { lastActiveAt: null } });
    await sweep();
    await ageNotice(idle, WARN + 1);
    const run = (await openRetentionRun(organizationId, "members"))!;
    const { noticeDueAtOrBefore } = getRetentionClockCutoffs(run.policy, run.now);

    // The sweep has read them as due; they renew a session before the deactivation runs.
    await renewSession(token);

    await expect(
      deactivateDueMember({ ...run, deadline: Date.now() + 60_000 }, idle, noticeDueAtOrBefore)
    ).resolves.toBeNull();
    expect(await isActive(idle)).toBe(true);
  });

  test("activity between the sweep's read and its claim voids the notice it claimed", async () => {
    const idle = await addMember("idle@example.com", "member", { lastLoginAt: ago(400) });

    // The sweep reads the member as away for 400 days and plans the notice from that clock...
    const run = (await openRetentionRun(organizationId, "members"))!;
    const plan = await createMembersSweeper()({ ...run, deadline: Date.now() + 60_000 });
    // ...and they were active before it claims the notice. Still old enough to be due, so the email's
    // date can't be told apart from a valid one, but it was computed from the old clock.
    await prisma.user.update({ where: { id: idle }, data: { lastActiveAt: ago(380) } });
    await plan.act(Date.now() + 60_000);
    await prisma.retentionRun.update({ where: { id: run.runId }, data: { finishedAt: new Date() } });
    expect(sendMemberRetentionNoticeEmail).toHaveBeenCalledOnce();

    // Its warning has run, but for a clock the member no longer has: no deactivation, a new notice.
    await ageNotice(idle, WARN + 1);
    await sweep();

    expect(await isActive(idle)).toBe(true);
    expect(sendMemberRetentionNoticeEmail).toHaveBeenCalledTimes(2);
  });

  test("counts a member who never signed in from when the policy took effect", async () => {
    const never = await addMember("never@example.com", "member", { lastLoginAt: null });

    await sweep();

    expect(sendMemberRetentionNoticeEmail).toHaveBeenCalledWith(
      expect.objectContaining({ email: "never@example.com" })
    );
    expect(await isActive(never)).toBe(true);
  });

  test("counts a pending invite to another organisation as belonging there too", async () => {
    const otherOrg = (await prisma.organization.create({ data: { name: "Other" } })).id;
    const invited = await addMember("Invited@example.com", "member", { lastLoginAt: ago(400) });
    const boss = (await prisma.user.findUniqueOrThrow({ where: { email: "boss@example.com" } })).id;
    await prisma.invite.create({
      data: { email: "invited@example.com", organizationId: otherOrg, creatorId: boss, expiresAt: ago(-7) },
    });

    await sweep();

    expect(sendMemberRetentionNoticeEmail).not.toHaveBeenCalled();
    expect(await prisma.retentionRunItem.findFirst({ where: { targetId: invited } })).toMatchObject({
      skipReason: "otherOrganization",
    });
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

  test("never warns or deactivates the last active owner", async () => {
    await prisma.user.updateMany({ where: { email: "boss@example.com" }, data: { lastLoginAt: ago(400) } });
    const boss = (await prisma.user.findUniqueOrThrow({ where: { email: "boss@example.com" } })).id;

    await sweep();

    expect(sendMemberRetentionNoticeEmail).not.toHaveBeenCalled();
    expect(await prisma.retentionRunItem.findFirst({ where: { action: "skipped" } })).toMatchObject({
      skipReason: "lastOwner",
      targetId: boss,
    });

    // Even with a valid notice on record from before (computed for their clock: their last sign-in),
    // the deactivation itself refuses.
    const { lastLoginAt } = await prisma.user.findUniqueOrThrow({ where: { id: boss } });
    await prisma.retentionNotice.create({
      data: {
        organizationId,
        entity: "members",
        userId: boss,
        sentAt: ago(WARN + 1),
        deliveredAt: ago(WARN + 1),
        clockAt: lastLoginAt,
      },
    });
    await sweep();
    expect(await isActive(boss)).toBe(true);
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
