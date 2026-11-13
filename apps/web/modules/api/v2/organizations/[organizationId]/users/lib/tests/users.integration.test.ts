import { beforeEach, describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";
import { resetDb } from "@/integration/reset-db";
import { deleteMembership } from "@/modules/organization/settings/teams/lib/membership";
import { lockOwnersAndCheckRemoval } from "@/modules/organization/settings/teams/lib/owner-guard";
import type { TUserInput } from "../../types/users";
import { createUser, updateUser } from "../users";

/**
 * End-to-end (service + real Postgres) smoke test for the ENG-1801 regression: a duplicate-email
 * create must return a 409 `conflict`, NOT a 500. This drives the exact bug path — real
 * `prisma.user.create` → real P2002 from adapter-pg → `isUniqueConstraintError` → conflict — with no
 * mocks, so it also confirms the `instanceof` guard works against a genuinely-thrown error.
 */
beforeEach(async () => {
  await resetDb();
});

describe("createUser duplicate handling vs real Postgres (ENG-1801)", () => {
  test("returns 409 conflict (not 500) on a real duplicate-email unique violation", async () => {
    const org = await prisma.organization.create({ data: { name: "ENG-1801 Org" } });
    const email = "eng1801-service@example.com";

    const first = await createUser({ name: "First", email, role: "owner" } as TUserInput, org.id);
    expect(first.ok).toBe(true);

    const second = await createUser({ name: "Second", email, role: "member" } as TUserInput, org.id);
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.error.type).toBe("conflict");
      expect(second.error.details).toEqual([
        { field: "email", issue: "A user with this email already exists" },
      ]);
    }
  });
});

describe("updateUser reactivating a user vs real Postgres (ENG-3612)", () => {
  /**
   * Turning an account back on through the API must restart the data retention members clock and clear
   * the notice that led to the deactivation, as Reactivate in the member list does. Otherwise the
   * nightly sweep finds the same old clock and the same delivered notice, and deactivates them again
   * with no warning.
   */
  test("restarts the retention clock and clears the members notice, once", async () => {
    const org = await prisma.organization.create({ data: { name: "Retention Org" } });
    const email = "returning@example.com";
    const user = await prisma.user.create({ data: { name: "Returning", email, isActive: false } });
    await prisma.membership.create({
      data: { userId: user.id, organizationId: org.id, role: "member", accepted: true },
    });
    await prisma.retentionNotice.create({
      data: {
        organizationId: org.id,
        entity: "members",
        userId: user.id,
        sentAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
        deliveredAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
      },
    });

    const result = await updateUser({ email, isActive: true }, org.id);

    expect(result.ok).toBe(true);
    const reactivated = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(reactivated.isActive).toBe(true);
    expect(Date.now() - reactivated.reactivatedAt!.getTime()).toBeLessThan(60_000);
    expect(await prisma.retentionNotice.count({ where: { userId: user.id } })).toBe(0);

    // Already active: a repeat of the same call is no reactivation, and moves nothing.
    await updateUser({ email, isActive: true }, org.id);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).reactivatedAt).toEqual(
      reactivated.reactivatedAt
    );
  });
});

describe("updateUser on a user who belongs to several organizations vs real Postgres (ENG-3807)", () => {
  /**
   * `name` and `isActive` are the account's, not the membership's: one organization changing them changes
   * them for every other organization the user is in, and deactivating locks the user out of all of them.
   */
  const setUp = async ({ isActive = true }: { isActive?: boolean } = {}) => {
    const orgA = await prisma.organization.create({ data: { name: "Org A" } });
    const orgB = await prisma.organization.create({ data: { name: "Org B" } });
    const email = "shared@example.com";
    const user = await prisma.user.create({ data: { name: "Original Name", email, isActive } });
    await prisma.membership.createMany({
      data: [
        { userId: user.id, organizationId: orgA.id, role: "member", accepted: true },
        { userId: user.id, organizationId: orgB.id, role: "owner", accepted: true },
      ],
    });
    const team = await prisma.team.create({ data: { name: "A Team", organizationId: orgA.id } });
    await prisma.teamUser.create({ data: { teamId: team.id, userId: user.id, role: "contributor" } });
    return { orgA, orgB, email, user, team };
  };

  test("one organization cannot deactivate them, and nothing else in the request is applied", async () => {
    const { orgA, email, user, team } = await setUp();

    const result = await updateUser({ email, isActive: false, teams: [] }, orgA.id);

    expect(result).toEqual({
      ok: false,
      error: {
        type: "conflict",
        details: [
          {
            field: "isActive",
            issue:
              "cannot be changed from one organization while the user also belongs to other organizations",
          },
        ],
      },
    });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).isActive).toBe(true);
    // The team removal sent alongside is rolled back with it.
    expect(await prisma.teamUser.count({ where: { teamId: team.id, userId: user.id } })).toBe(1);
  });

  test("one organization cannot reactivate them either", async () => {
    const { orgA, email, user } = await setUp({ isActive: false });

    const result = await updateUser({ email, isActive: true }, orgA.id);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.type).toBe("conflict");
    const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.isActive).toBe(false);
    expect(after.reactivatedAt).toBeNull();
  });

  test("one organization cannot rename them", async () => {
    const { orgA, email, user } = await setUp();

    const result = await updateUser({ email, name: "Renamed By A" }, orgA.id);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe("conflict");
      expect(result.error.details?.map(({ field }) => field)).toEqual(["name"]);
    }
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).name).toBe("Original Name");
  });

  test("sending the stored name and state back is no change, so the rest of the request applies", async () => {
    const { orgA, email, user } = await setUp();

    const result = await updateUser(
      { email, name: "Original Name", isActive: true, role: "manager" },
      orgA.id
    );

    expect(result.ok).toBe(true);
    const membership = await prisma.membership.findUniqueOrThrow({
      where: { userId_organizationId: { userId: user.id, organizationId: orgA.id } },
    });
    expect(membership.role).toBe("manager");
  });

  test("counts a membership another organization is adding at the same moment", async () => {
    const org = await prisma.organization.create({ data: { name: "Only Org" } });
    const other = await prisma.organization.create({ data: { name: "Joining Org" } });
    const email = "joining@example.com";
    const user = await prisma.user.create({ data: { name: "Joining", email, isActive: true } });
    await prisma.membership.create({
      data: { userId: user.id, organizationId: org.id, role: "member", accepted: true },
    });

    // Another organization adds the user in a transaction that stays open until released.
    let inserted!: (pid: number) => void;
    let release!: () => void;
    const insertedSignal = new Promise<number>((resolve) => (inserted = resolve));
    const releaseSignal = new Promise<void>((resolve) => (release = resolve));
    const joining = prisma.$transaction(
      async (tx) => {
        await tx.membership.create({
          data: { userId: user.id, organizationId: other.id, role: "member", accepted: true },
        });
        const [{ pid }] = await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;
        inserted(pid);
        await releaseSignal;
      },
      { timeout: 10_000 }
    );
    const joiningPid = await insertedSignal;

    // The deactivation has to wait for that insert under the user row's lock, then sees it. Wait until
    // Postgres reports it blocked by the joining transaction rather than sleeping: with no lock it never
    // blocks, and this fails instead of passing by timing.
    const deactivating = updateUser({ email, isActive: false }, org.id);
    let blocked = false;
    try {
      for (let attempt = 0; attempt < 250 && !blocked; attempt++) {
        const [{ waiting }] = await prisma.$queryRaw<{ waiting: bigint }[]>`
          SELECT count(*) AS waiting FROM pg_stat_activity WHERE ${joiningPid}::int = ANY(pg_blocking_pids(pid))
        `;
        blocked = waiting > 0n;
        if (!blocked) await new Promise((resolve) => setTimeout(resolve, 20));
      }
    } finally {
      release();
    }
    await joining;
    expect(blocked).toBe(true);

    const result = await deactivating;
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.type).toBe("conflict");
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).isActive).toBe(true);
  });

  test("an owner can be demoted and renamed or deactivated in one request, all or nothing", async () => {
    const owners = async (orgName: string, emails: string[]) => {
      const org = await prisma.organization.create({ data: { name: orgName } });
      const users = await Promise.all(
        emails.map((email) => prisma.user.create({ data: { name: "Owner", email, isActive: true } }))
      );
      await prisma.membership.createMany({
        data: users.map((user) => ({
          userId: user.id,
          organizationId: org.id,
          role: "owner",
          accepted: true,
        })),
      });
      return { org, user: users[0] };
    };
    const state = async (userId: string, organizationId: string) => {
      const user = await prisma.user.findUniqueOrThrow({
        where: { id: userId },
        include: { memberships: { where: { organizationId } } },
      });
      return { name: user.name, isActive: user.isActive, role: user.memberships[0].role };
    };

    const twoOwners = await owners("Two Owners", ["owner@example.com", "other-owner@example.com"]);
    const combined = await updateUser(
      { email: "owner@example.com", role: "member", name: "Renamed", isActive: false },
      twoOwners.org.id
    );
    expect(combined.ok).toBe(true);
    expect(await state(twoOwners.user.id, twoOwners.org.id)).toEqual({
      name: "Renamed",
      isActive: false,
      role: "member",
    });

    // The last owner can't be demoted, and the rename sent with it is rolled back too.
    const oneOwner = await owners("One Owner", ["last-owner@example.com"]);
    const refused = await updateUser(
      { email: "last-owner@example.com", role: "member", name: "Renamed" },
      oneOwner.org.id
    );
    expect(refused).toMatchObject({ ok: false, error: { type: "conflict", details: [{ field: "role" }] } });
    expect(await state(oneOwner.user.id, oneOwner.org.id)).toEqual({
      name: "Owner",
      isActive: true,
      role: "owner",
    });
  });

  test("a user in this organization alone can still be renamed and deactivated", async () => {
    const org = await prisma.organization.create({ data: { name: "Only Org" } });
    const email = "solo@example.com";
    const user = await prisma.user.create({ data: { name: "Solo", email, isActive: true } });
    await prisma.membership.create({
      data: { userId: user.id, organizationId: org.id, role: "member", accepted: true },
    });

    const result = await updateUser({ email, name: "Renamed", isActive: false }, org.id);

    expect(result.ok).toBe(true);
    const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after).toMatchObject({ name: "Renamed", isActive: false });
  });
});

describe("updateUser deactivating an organization's owners vs real Postgres (ENG-6767)", () => {
  /** An organization whose owners are the given users, each active or not. */
  const organizationWithOwners = async (owners: { email: string; isActive: boolean }[]) => {
    const org = await prisma.organization.create({ data: { name: "Owned Org" } });
    const users = [];
    for (const { email, isActive } of owners) {
      const user = await prisma.user.create({ data: { name: "Owner", email, isActive } });
      await prisma.membership.create({
        data: { userId: user.id, organizationId: org.id, role: "owner", accepted: true },
      });
      users.push(user);
    }
    return { org, users };
  };
  const activeOwners = (organizationId: string) =>
    prisma.membership.count({ where: { organizationId, role: "owner", user: { isActive: true } } });

  test("refuses to deactivate the last active owner, and rolls back the rest of the request", async () => {
    // The other owner is already inactive, so it does not count as an owner who can still sign in.
    const { org, users } = await organizationWithOwners([
      { email: "last@example.com", isActive: true },
      { email: "inactive@example.com", isActive: false },
    ]);
    const team = await prisma.team.create({ data: { name: "Owners", organizationId: org.id } });
    await prisma.teamUser.create({ data: { teamId: team.id, userId: users[0].id, role: "contributor" } });

    const result = await updateUser({ email: "last@example.com", isActive: false, teams: [] }, org.id);

    expect(result).toEqual({
      ok: false,
      error: {
        type: "conflict",
        details: [{ field: "isActive", issue: "Cannot remove the last owner of the organization" }],
      },
    });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: users[0].id } })).isActive).toBe(true);
    expect(await prisma.teamUser.count({ where: { teamId: team.id, userId: users[0].id } })).toBe(1);
  });

  test("deactivates an owner while another active owner remains", async () => {
    const { org, users } = await organizationWithOwners([
      { email: "leaving@example.com", isActive: true },
      { email: "staying@example.com", isActive: true },
    ]);

    const result = await updateUser({ email: "leaving@example.com", isActive: false }, org.id);

    expect(result).toMatchObject({ ok: true, data: { isActive: false, role: "owner" } });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: users[0].id } })).isActive).toBe(false);
    expect(await activeOwners(org.id)).toBe(1);
  });

  test("deactivating an owner who is already inactive is a no-op, not a conflict", async () => {
    const { org } = await organizationWithOwners([
      { email: "active@example.com", isActive: true },
      { email: "gone@example.com", isActive: false },
    ]);

    const result = await updateUser({ email: "gone@example.com", isActive: false }, org.id);

    expect(result).toMatchObject({ ok: true, data: { isActive: false } });
    expect(await activeOwners(org.id)).toBe(1);
  });

  const ROUNDS = 5;

  test("two owners deactivated at once leave one of them active, and the other request gets a 409", async () => {
    for (let round = 0; round < ROUNDS; round++) {
      const emails = [`race-a-${round}@example.com`, `race-b-${round}@example.com`];
      const { org } = await organizationWithOwners(emails.map((email) => ({ email, isActive: true })));

      const results = await Promise.all(
        emails.map((email) => updateUser({ email, isActive: false }, org.id))
      );

      expect(await activeOwners(org.id)).toBe(1);
      expect(results.filter((result) => result.ok)).toHaveLength(1);
      expect(results.find((result) => !result.ok)).toMatchObject({
        ok: false,
        error: { type: "conflict", details: [{ field: "isActive" }] },
      });
    }
  });

  test("a deactivation racing a demotion of the other owner leaves one active owner", async () => {
    for (let round = 0; round < ROUNDS; round++) {
      const [deactivated, demoted] = [`deact-${round}@example.com`, `demote-${round}@example.com`];
      const { org } = await organizationWithOwners([
        { email: deactivated, isActive: true },
        { email: demoted, isActive: true },
      ]);

      const results = await Promise.all([
        updateUser({ email: deactivated, isActive: false }, org.id),
        updateUser({ email: demoted, role: "member" }, org.id),
      ]);

      expect(await activeOwners(org.id)).toBe(1);
      expect(results.filter((result) => result.ok)).toHaveLength(1);
      expect(results.find((result) => !result.ok)).toMatchObject({ ok: false, error: { type: "conflict" } });
    }
  });

  test("waits for a transaction holding the owners' lock, then counts what it committed", async () => {
    // The data retention members sweep deactivates an owner at Read Committed under this same lock.
    // Serializable isolation alone would not see that clash: only a shared lock makes this request wait.
    const { org, users } = await organizationWithOwners([
      { email: "swept@example.com", isActive: true },
      { email: "patched@example.com", isActive: true },
    ]);

    let locked!: (pid: number) => void;
    let release!: () => void;
    const lockedSignal = new Promise<number>((resolve) => (locked = resolve));
    const releaseSignal = new Promise<void>((resolve) => (release = resolve));
    const sweeping = prisma.$transaction(
      async (tx) => {
        await lockOwnersAndCheckRemoval(tx, org.id, users[0].id);
        await tx.user.update({ where: { id: users[0].id }, data: { isActive: false } });
        const [{ pid }] = await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;
        locked(pid);
        await releaseSignal;
      },
      { timeout: 10_000 }
    );
    const sweepingPid = await lockedSignal;

    const patching = updateUser({ email: "patched@example.com", isActive: false }, org.id);
    let blocked = false;
    try {
      for (let attempt = 0; attempt < 250 && !blocked; attempt++) {
        const [{ waiting }] = await prisma.$queryRaw<{ waiting: bigint }[]>`
          SELECT count(*) AS waiting FROM pg_stat_activity WHERE ${sweepingPid}::int = ANY(pg_blocking_pids(pid))
        `;
        blocked = waiting > 0n;
        if (!blocked) await new Promise((resolve) => setTimeout(resolve, 20));
      }
    } finally {
      release();
    }
    await sweeping;
    expect(blocked).toBe(true);

    expect(await patching).toMatchObject({
      ok: false,
      error: { type: "conflict", details: [{ field: "isActive" }] },
    });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: users[1].id } })).isActive).toBe(true);
    expect(await activeOwners(org.id)).toBe(1);
  });

  test("a deactivation racing the removal of the other owner leaves one active owner", async () => {
    for (let round = 0; round < ROUNDS; round++) {
      const emails = [`patch-${round}@example.com`, `removed-${round}@example.com`];
      const { org, users } = await organizationWithOwners(emails.map((email) => ({ email, isActive: true })));

      const [patched, removed] = await Promise.allSettled([
        updateUser({ email: emails[0], isActive: false }, org.id),
        deleteMembership(users[1].id, org.id),
      ]);

      expect(await activeOwners(org.id)).toBe(1);
      const patchSucceeded = patched.status === "fulfilled" && patched.value.ok;
      expect(patchSucceeded).toBe(removed.status === "rejected");
      if (!patchSucceeded) {
        expect(patched).toMatchObject({
          status: "fulfilled",
          value: { ok: false, error: { type: "conflict" } },
        });
      }
    }
  });
});
