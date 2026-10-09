import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import { revokeAllUserOAuthGrants } from "@/modules/auth/lib/oauth-grant-revocation";
import { revokeUserSessionsExcept } from "@/modules/auth/lib/session-revocation";
import { queueAuditEventWithoutRequest } from "@/modules/ee/audit-logs/lib/handler";
import { sendMemberRetentionNoticeEmail } from "@/modules/email";
import { addRetentionDays } from "../lib/schedule";
import { createMembersSweeper, deactivateDueMember, revokeCredentials } from "./members-sweeper";
import { claimRetentionNotice, markRetentionNoticeDelivered } from "./notices";
import { recordRetentionRunActions, recordRetentionRunSkips } from "./run";
import type { TRetentionSweepContext } from "./sweep";
import {
  type TRetentionPolicySnapshot,
  lockUnchangedRetentionPolicy,
  readDatabaseClock,
  runSweepTransaction,
} from "./transaction";

vi.mock("server-only", () => ({}));
vi.mock("@formbricks/database", () => ({
  prisma: {
    $transaction: vi.fn(),
    retentionRun: { update: vi.fn() },
    organization: { findUniqueOrThrow: vi.fn() },
    user: { findUnique: vi.fn() },
  },
}));
vi.mock("@formbricks/logger", () => ({ logger: { info: vi.fn(), error: vi.fn() } }));
vi.mock("@/modules/auth/lib/oauth-grant-revocation", () => ({ revokeAllUserOAuthGrants: vi.fn() }));
vi.mock("@/modules/auth/lib/session-revocation", () => ({ revokeUserSessionsExcept: vi.fn() }));
vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({ queueAuditEventWithoutRequest: vi.fn() }));
vi.mock("@/modules/email", () => ({ sendMemberRetentionNoticeEmail: vi.fn() }));
vi.mock("./notices", () => ({ claimRetentionNotice: vi.fn(), markRetentionNoticeDelivered: vi.fn() }));
vi.mock("./run", () => ({ recordRetentionRunActions: vi.fn(), recordRetentionRunSkips: vi.fn() }));
vi.mock("./transaction", () => ({
  runSweepTransaction: vi.fn(),
  lockUnchangedRetentionPolicy: vi.fn(),
  readDatabaseClock: vi.fn(),
}));

/**
 * The members policy against a real database (a sign-in or recorded activity moves the clock, someone in
 * another organisation is left alone, the last active owner is never deactivated, sessions and grants
 * end, Reactivate wins a race) is proven in `members-sweeper.integration.test.ts`. These pin the
 * decisions made on what the queries return.
 */
const statement = (args: unknown[]) => {
  const [strings, ...values] = args as [TemplateStringsArray, ...unknown[]];
  const sql = Prisma.sql(strings, ...values);
  return { text: sql.sql.replace(/\s+/g, " "), values: sql.values };
};

/** The value bound to the `?` that ends `marker` in the statement, if the statement has it. */
const boundAt = (text: string, values: unknown[], marker: string): unknown => {
  const end = text.indexOf(marker);
  if (end === -1) return undefined;
  return values[(text.slice(0, end + marker.length).match(/\?/g) ?? []).length - 1];
};

const NOW = new Date("2030-03-01T12:00:00.000Z");
const daysAgo = (days: number) => addRetentionDays(NOW, -days);
const POLICY: TRetentionPolicySnapshot = {
  id: "clpol",
  organizationId: "clorg",
  entity: "members",
  enabledAt: daysAgo(60),
  warnDays: 7,
  periodDays: 30,
  conditions: [],
};
const NOTICE_DUE_AT_OR_BEFORE = daysAgo(23);

const context = (): TRetentionSweepContext => ({
  runId: "clrun",
  now: NOW,
  policy: POLICY,
  restartedWarning: null,
  resumeAfter: null,
  deadline: NOW.getTime() + 120_000,
});

type TRow = {
  userId: string;
  email: string;
  locale: string;
  role: "owner" | "manager" | "member" | "billing";
  lastLoginAt: Date | null;
  lastActiveAt: Date | null;
  reactivatedAt: Date | null;
  organizationCount: number;
  noticeClaimedAt: Date | null;
  noticeDeliveredAt: Date | null;
  noticeClockAt: Date | null;
};
/** Last signed in 25 days ago: their notice is due. */
const member = (userId: string, overrides: Partial<TRow> = {}): TRow => ({
  userId,
  email: `${userId}@example.com`,
  locale: "en-US",
  role: "member",
  lastLoginAt: daysAgo(25),
  lastActiveAt: null,
  reactivatedAt: null,
  organizationCount: 1,
  noticeClaimedAt: null,
  noticeDeliveredAt: null,
  noticeClockAt: null,
  ...overrides,
});
/** Away for 40 days and told 10 days ago: their warning has run, they are due to be deactivated. */
const dueForDeactivation = (userId: string, overrides: Partial<TRow> = {}) =>
  member(userId, {
    lastLoginAt: daysAgo(40),
    noticeClaimedAt: daysAgo(10),
    noticeDeliveredAt: daysAgo(10),
    noticeClockAt: daysAgo(40),
    ...overrides,
  });

/** The database as the sweeper's statements see it. */
const database = ({
  candidates = [] as TRow[],
  recheck = (userId: string): TRow[] => candidates.filter((row) => row.userId === userId),
  activeOwners = 2,
  otherActiveOwners = 1,
} = {}) => {
  const tx = {
    $queryRaw: vi.fn(async (...args: unknown[]) => {
      const { text, values } = statement(args);
      if (!text.includes('FROM "Membership" m JOIN "User" u')) return [];
      const userId = boundAt(text, values, 'AND u."id" = ?');
      return userId === undefined ? candidates : recheck(userId as string);
    }),
    membership: {
      count: vi.fn(async ({ where }: { where: { userId?: unknown } }) =>
        where.userId ? otherActiveOwners : activeOwners
      ),
    },
    user: { update: vi.fn() },
  };
  vi.mocked(runSweepTransaction).mockImplementation(((fn: (client: typeof tx) => unknown) =>
    fn(tx)) as never);
  return tx;
};

const sweep = async (deadline = NOW.getTime() + 60_000) => {
  const plan = await createMembersSweeper()(context());
  await plan.act(deadline);
  return plan;
};

const skipped = () => vi.mocked(recordRetentionRunSkips).mock.calls[0]?.[1];

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  vi.mocked(readDatabaseClock).mockResolvedValue(NOW);
  vi.mocked(claimRetentionNotice).mockResolvedValue("token-1");
  vi.mocked(markRetentionNoticeDelivered).mockResolvedValue(true);
  vi.mocked(sendMemberRetentionNoticeEmail).mockResolvedValue(true);
  vi.mocked(prisma.organization.findUniqueOrThrow).mockResolvedValue({
    name: "Acme",
    displayTimeZone: "Pacific/Auckland",
  } as never);
  vi.mocked(prisma.user.findUnique).mockResolvedValue({ isActive: false } as never);
  vi.mocked(prisma.$transaction).mockImplementation(((fn: (tx: unknown) => unknown) =>
    fn({ oauth: true })) as never);
});
afterEach(() => {
  vi.useRealTimers();
});

describe("createMembersSweeper: notices", () => {
  test("tells a member themselves, in their locale, when they will be deactivated", async () => {
    // The notice is stamped with the clock it was computed for, here their last sign-in: any activity
    // since, even before the claim, voids it.
    database({ candidates: [member("alice", { locale: "de-DE" })] });

    await sweep();

    expect(claimRetentionNotice).toHaveBeenCalledWith(
      expect.anything(),
      { organizationId: "clorg", entity: "members", userId: "alice" },
      { claimedAt: NOW, voidBefore: POLICY.enabledAt, clockAt: daysAgo(25) }
    );
    expect(lockUnchangedRetentionPolicy).toHaveBeenCalledWith(expect.anything(), POLICY);
    // Told now, the full warning runs from tonight: noon UTC on 8 March, already the 9th in Auckland.
    expect(sendMemberRetentionNoticeEmail).toHaveBeenCalledWith({
      email: "alice@example.com",
      locale: "de-DE",
      organizationName: "Acme",
      deactivateDate: "9. März 2030",
    });
    expect(markRetentionNoticeDelivered).toHaveBeenCalledWith(
      expect.anything(),
      { organizationId: "clorg", entity: "members", userId: "alice" },
      { claimToken: "token-1", deliveredAt: NOW, emailSent: true }
    );
    expect(recordRetentionRunActions).toHaveBeenCalledWith(expect.anything(), "clrun", [
      {
        targetType: "user",
        targetId: "alice",
        targetName: null,
        action: "notified",
        recipient: "alice@example.com",
      },
    ]);
  });

  test("voids a notice from before the policy took effect, for someone who never signed in", async () => {
    database({ candidates: [member("alice", { lastLoginAt: null, locale: "nope" })] });

    await sweep();

    expect(claimRetentionNotice).toHaveBeenCalledWith(expect.anything(), expect.anything(), {
      claimedAt: NOW,
      voidBefore: POLICY.enabledAt,
      // Counted from when the policy took effect.
      clockAt: POLICY.enabledAt,
    });
    expect(sendMemberRetentionNoticeEmail).toHaveBeenCalledWith(expect.objectContaining({ locale: "en-US" }));
  });

  test("never warns someone in another organisation, nor the last active owner", async () => {
    database({
      candidates: [member("multi", { organizationCount: 2 }), member("owner", { role: "owner" })],
      activeOwners: 1,
    });

    await sweep();

    expect(claimRetentionNotice).not.toHaveBeenCalled();
    expect(skipped()).toEqual([
      { targetType: "user", targetId: "multi", skipReason: "otherOrganization" },
      { targetType: "user", targetId: "owner", skipReason: "lastOwner" },
    ]);
  });

  test("warns an owner when another owner is still active", async () => {
    database({ candidates: [member("owner", { role: "owner" })], activeOwners: 2 });

    await sweep();

    expect(claimRetentionNotice).toHaveBeenCalledTimes(1);
    expect(skipped()).toEqual([]);
  });

  test("sends nothing for a notice that is still valid or claimed by another sweep", async () => {
    database({ candidates: [member("alice")] });
    vi.mocked(claimRetentionNotice).mockResolvedValue(null);

    await sweep();

    expect(sendMemberRetentionNoticeEmail).not.toHaveBeenCalled();
  });

  test("records the notice with no recipient when there is no SMTP", async () => {
    database({ candidates: [member("alice")] });
    vi.mocked(sendMemberRetentionNoticeEmail).mockResolvedValue(false);

    await sweep();

    expect(recordRetentionRunActions).toHaveBeenCalledWith(expect.anything(), "clrun", [
      expect.objectContaining({ targetId: "alice", recipient: null }),
    ]);
  });

  test("leaves a failed email's claim undelivered, and moves on", async () => {
    database({ candidates: [member("alice"), member("bob")] });
    vi.mocked(sendMemberRetentionNoticeEmail).mockRejectedValueOnce(new Error("SMTP 451"));

    await sweep();

    expect(vi.mocked(markRetentionNoticeDelivered).mock.calls.map(([, target]) => target)).toEqual([
      { organizationId: "clorg", entity: "members", userId: "bob" },
    ]);
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "alice", runId: "clrun" }),
      "Member retention notice failed"
    );
  });

  test("records nothing for a claim taken over before its delivery was recorded", async () => {
    database({ candidates: [member("alice")] });
    vi.mocked(markRetentionNoticeDelivered).mockResolvedValue(false);

    await sweep();

    expect(recordRetentionRunActions).not.toHaveBeenCalled();
  });

  test("starts no notice and no deactivation past the deadline, but still records the skips", async () => {
    database({ candidates: [member("alice"), dueForDeactivation("bob")] });

    await sweep(NOW.getTime() - 1);

    expect(claimRetentionNotice).not.toHaveBeenCalled();
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(recordRetentionRunSkips).toHaveBeenCalled();
  });
});

describe("createMembersSweeper: deactivations", () => {
  test("deactivates a member whose warning has run, ends their access, and audits it", async () => {
    const tx = database({ candidates: [dueForDeactivation("bob")] });

    await sweep();

    expect(tx.user.update).toHaveBeenCalledWith({ where: { id: "bob" }, data: { isActive: false } });
    expect(recordRetentionRunActions).toHaveBeenCalledWith(tx, "clrun", [
      { targetType: "user", targetId: "bob", targetName: null, action: "deactivated" },
    ]);
    expect(revokeUserSessionsExcept).toHaveBeenCalledWith({ userId: "bob" });
    expect(revokeAllUserOAuthGrants).toHaveBeenCalledWith({ oauth: true }, "bob");
    expect(queueAuditEventWithoutRequest).toHaveBeenCalledWith({
      action: "deactivated",
      targetType: "user",
      targetId: "bob",
      organizationId: "clorg",
      userId: "system",
      userType: "system",
      status: "success",
      newObject: { isActive: false, retentionRunId: "clrun" },
    });
  });

  test("records someone found in another organisation, or the last active owner, as skipped", async () => {
    database({
      candidates: [dueForDeactivation("multi"), dueForDeactivation("owner", { role: "owner" })],
      // Joined another organisation since the scan.
      recheck: (userId) =>
        userId === "multi"
          ? [dueForDeactivation("multi", { organizationCount: 2 })]
          : [dueForDeactivation("owner", { role: "owner" })],
      activeOwners: 2,
      otherActiveOwners: 0,
    });

    await sweep();

    expect(revokeUserSessionsExcept).not.toHaveBeenCalled();
    expect(skipped()).toEqual([
      { targetType: "user", targetId: "multi", skipReason: "otherOrganization" },
      { targetType: "user", targetId: "owner", skipReason: "lastOwner" },
    ]);
  });

  test("keeps a deactivation whose audit fails", async () => {
    database({ candidates: [dueForDeactivation("bob")] });
    vi.mocked(queueAuditEventWithoutRequest).mockRejectedValue(new Error("audit down"));

    await expect(sweep()).resolves.toBeDefined();
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "bob" }),
      "Data retention deactivation audit failed"
    );
  });
});

describe("deactivateDueMember", () => {
  test("takes the owners' memberships, then the user, then the policy, before it re-reads the member", async () => {
    const tx = database({ candidates: [dueForDeactivation("bob")] });

    await expect(deactivateDueMember(context(), "bob", NOTICE_DUE_AT_OR_BEFORE)).resolves.toBe("deactivated");

    const [owners, user, reread] = tx.$queryRaw.mock.calls.map(statement);
    expect(owners.text).toContain(
      'FROM "Membership" WHERE "organizationId" = ? AND "role" = \'owner\' ORDER BY "userId" FOR UPDATE'
    );
    expect(user.text).toBe('SELECT 1 FROM "User" WHERE "id" = ? FOR UPDATE');
    expect(user.values).toEqual(["bob"]);
    expect(reread.values).toEqual([NOW, "clorg", POLICY.enabledAt, NOTICE_DUE_AT_OR_BEFORE, "bob", 100]);
    // The clock's activity is the recorded `lastActiveAt`, never the live `Session` rows, which a
    // sign-out or an expiry deletes along with the activity they showed.
    expect(reread.text).toContain(
      'GREATEST( COALESCE(u."lastLoginAt", ?), u."reactivatedAt", u."lastActiveAt" ) <= ?'
    );
    expect(reread.text).not.toContain('"Session"');
    expect(vi.mocked(lockUnchangedRetentionPolicy).mock.invocationCallOrder[0]).toBeLessThan(
      tx.$queryRaw.mock.invocationCallOrder[2]
    );
  });

  test("deactivates an owner while another owner is still active", async () => {
    const tx = database({
      candidates: [dueForDeactivation("owner", { role: "owner" })],
      otherActiveOwners: 1,
    });

    await expect(deactivateDueMember(context(), "owner", NOTICE_DUE_AT_OR_BEFORE)).resolves.toBe(
      "deactivated"
    );
    expect(tx.membership.count).toHaveBeenCalledWith({
      where: { organizationId: "clorg", role: "owner", userId: { not: "owner" }, user: { isActive: true } },
    });
  });

  test.each([
    ["is no longer an active member", []],
    ["signed in since their notice", [dueForDeactivation("bob", { lastLoginAt: daysAgo(1) })]],
    ["renewed a session since their notice", [dueForDeactivation("bob", { lastActiveAt: daysAgo(1) })]],
    // Active after the sweep read them and before the notice was claimed: still old enough that the
    // action would be due, but the notice was computed for the earlier clock, so it doesn't count.
    [
      "was active after the notice's clock was read",
      [dueForDeactivation("bob", { lastActiveAt: daysAgo(39) })],
    ],
  ])("does nothing when the member %s", async (_case, rows) => {
    const tx = database({ recheck: () => rows });

    await expect(deactivateDueMember(context(), "bob", NOTICE_DUE_AT_OR_BEFORE)).resolves.toBeNull();
    expect(tx.user.update).not.toHaveBeenCalled();
  });
});

describe("revokeCredentials", () => {
  test("leaves someone reactivated in between, or gone, alone", async () => {
    vi.mocked(prisma.user.findUnique)
      .mockResolvedValueOnce({ isActive: true } as never)
      .mockResolvedValueOnce(null);

    await revokeCredentials("bob");
    await revokeCredentials("bob");

    expect(revokeUserSessionsExcept).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  test("never throws: the deactivation has already committed", async () => {
    vi.mocked(revokeUserSessionsExcept).mockRejectedValue(new Error("redis down"));

    await expect(revokeCredentials("bob")).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "bob" }),
      "Revoking a deactivated member's credentials failed"
    );
  });
});
