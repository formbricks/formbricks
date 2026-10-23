import { beforeEach, describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";
import { resetDb } from "@/integration/reset-db";
// The data migration under test (auto-discovered by the migration runner at deploy).
import { backfillUserLastActiveAt } from "../../../packages/database/migration/20261007120001_backfill_user_last_active_at/migration";

/**
 * ENG-3612: the `User.lastActiveAt` backfill against real Postgres. The runner supplies `run` with its
 * interactive transaction; the backfill only uses the autocommit `prisma` handle, which stands in here.
 */
const runBackfill = () => backfillUserLastActiveAt.run!({ prisma, tx: prisma as never });

const DAY = 24 * 60 * 60 * 1000;

const addUser = async (name: string, lastActiveAt: Date | null = null, lastLoginAt: Date | null = null) =>
  (await prisma.user.create({ data: { name, email: `${name}@example.com`, lastActiveAt, lastLoginAt } })).id;

/**
 * A session last renewed `renewedDaysAgo` and expiring in `expiresInDays` (negative: already expired).
 * Written raw, in UTC as Better Auth writes it: Prisma would stamp `updated_at` with now.
 */
const addSession = (userId: string, renewedDaysAgo: number, expiresInDays: number) =>
  prisma.$executeRaw`
    INSERT INTO "Session" ("id", "sessionToken", "userId", "updated_at", "expires")
    VALUES (
      gen_random_uuid()::text, gen_random_uuid()::text, ${userId},
      (now() AT TIME ZONE 'UTC') - make_interval(secs => ${renewedDaysAgo * 86_400}::double precision),
      (now() AT TIME ZONE 'UTC') + make_interval(secs => ${expiresInDays * 86_400}::double precision)
    )`;

const lastActiveOf = async (userId: string) =>
  (await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { lastActiveAt: true } }))
    .lastActiveAt;

/** The newest renewal among a user's sessions that haven't expired. */
const newestLiveRenewal = async (userId: string) => {
  const sessions = await prisma.session.findMany({ where: { userId } });
  const live = sessions.filter((session) => session.expires.getTime() > Date.now());
  return live.reduce<Date | null>(
    (newest, session) => (newest && newest >= session.updatedAt ? newest : session.updatedAt),
    null
  );
};

describe("backfillUserLastActiveAt (real Postgres)", () => {
  beforeEach(async () => {
    await resetDb();
  });

  test("seeds from the last sign-in and the live sessions, whichever is newer", async () => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * DAY);
    const signInOnly = await addUser("sign-in-only", null, thirtyDaysAgo);
    const signInNewer = await addUser("sign-in-newer", null, new Date(Date.now() - DAY));
    await addSession(signInNewer, 10, 5);
    const sessionNewer = await addUser("session-newer", null, new Date(Date.now() - 40 * DAY));
    await addSession(sessionNewer, 2, 5);

    await runBackfill();

    expect(await lastActiveOf(signInOnly)).toEqual(thirtyDaysAgo);
    expect(await lastActiveOf(signInNewer)).toEqual(
      (await prisma.user.findUniqueOrThrow({ where: { id: signInNewer } })).lastLoginAt
    );
    expect(await lastActiveOf(sessionNewer)).toEqual(await newestLiveRenewal(sessionNewer));
  });

  test("walks every user, past the first batch, however many have nothing to seed", async () => {
    // More users with nothing to seed than one batch holds (5,000), all sorting before the one that has.
    await prisma.$executeRaw`
      INSERT INTO "User" ("id", "created_at", "updated_at", "name", "email")
      SELECT 'aaa' || lpad(n::text, 6, '0'), now(), now(), 'Never', 'never' || n || '@example.com'
      FROM generate_series(1, 5_100) n`;
    const lastLoginAt = new Date(Date.now() - 3 * DAY);
    await prisma.user.create({
      data: { id: "zzz-last", name: "Last", email: "last@example.com", lastLoginAt },
    });

    await runBackfill();

    expect(await lastActiveOf("zzz-last")).toEqual(lastLoginAt);
    expect(await prisma.user.count({ where: { lastActiveAt: { not: null } } })).toBe(1);
  });

  test("seeds each user from their live sessions when they have no sign-in, and leaves a recorded value alone", async () => {
    const live = await addUser("live");
    await addSession(live, 2, 5);
    const expiredOnly = await addUser("expired-only");
    await addSession(expiredOnly, 10, -1);
    const none = await addUser("none");
    // An expired session renewed more recently than the live one: it must not count.
    const mixed = await addUser("mixed");
    await addSession(mixed, 5, 5);
    await addSession(mixed, 1, -1 / 24);
    const twoLive = await addUser("two-live");
    await addSession(twoLive, 3, 5);
    await addSession(twoLive, 1, 5);
    const recorded = new Date(Date.now() - 20 * DAY);
    const alreadySet = await addUser("already-set", recorded);
    await addSession(alreadySet, 1, 5);

    await runBackfill();

    expect(await lastActiveOf(live)).toEqual(await newestLiveRenewal(live));
    expect(await lastActiveOf(expiredOnly)).toBeNull();
    expect(await lastActiveOf(none)).toBeNull();
    const mixedLive = await newestLiveRenewal(mixed);
    expect(Date.now() - mixedLive!.getTime()).toBeGreaterThan(4 * DAY);
    expect(await lastActiveOf(mixed)).toEqual(mixedLive);
    expect(await lastActiveOf(twoLive)).toEqual(await newestLiveRenewal(twoLive));
    expect(await lastActiveOf(alreadySet)).toEqual(recorded);
  });

  test("a rerun changes nothing, and an empty database is a no-op", async () => {
    await expect(runBackfill()).resolves.toBeUndefined();

    const user = await addUser("live");
    await addSession(user, 2, 5);
    await addUser("no-session");
    await runBackfill();
    const before = await prisma.user.findMany({
      orderBy: { id: "asc" },
      select: { id: true, lastActiveAt: true },
    });

    await runBackfill();

    expect(
      await prisma.user.findMany({ orderBy: { id: "asc" }, select: { id: true, lastActiveAt: true } })
    ).toEqual(before);
  });
});
