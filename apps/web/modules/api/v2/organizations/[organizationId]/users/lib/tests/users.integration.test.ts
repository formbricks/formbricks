import { beforeEach, describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";
import { resetDb } from "@/integration/reset-db";
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
    let inserted!: () => void;
    let release!: () => void;
    const insertedSignal = new Promise<void>((resolve) => (inserted = resolve));
    const releaseSignal = new Promise<void>((resolve) => (release = resolve));
    const joining = prisma.$transaction(
      async (tx) => {
        await tx.membership.create({
          data: { userId: user.id, organizationId: other.id, role: "member", accepted: true },
        });
        inserted();
        await releaseSignal;
      },
      { timeout: 10_000 }
    );
    await insertedSignal;

    // The deactivation has to wait for that insert under the user row's lock, then sees it.
    const deactivating = updateUser({ email, isActive: false }, org.id);
    await new Promise((resolve) => setTimeout(resolve, 300));
    release();
    await joining;

    const result = await deactivating;
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.type).toBe("conflict");
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).isActive).toBe(true);
  });

  test("an owner's demotion and a change to their name or state go in separate requests", async () => {
    const org = await prisma.organization.create({ data: { name: "Two Owners" } });
    const email = "owner@example.com";
    const user = await prisma.user.create({ data: { name: "Owner", email, isActive: true } });
    const otherOwner = await prisma.user.create({
      data: { name: "Other Owner", email: "other-owner@example.com", isActive: true },
    });
    await prisma.membership.createMany({
      data: [
        { userId: user.id, organizationId: org.id, role: "owner", accepted: true },
        { userId: otherOwner.id, organizationId: org.id, role: "owner", accepted: true },
      ],
    });
    const role = async () =>
      (
        await prisma.membership.findUniqueOrThrow({
          where: { userId_organizationId: { userId: user.id, organizationId: org.id } },
        })
      ).role;

    const combined = await updateUser({ email, role: "member", isActive: false }, org.id);

    expect(combined).toMatchObject({ ok: false, error: { type: "conflict", details: [{ field: "role" }] } });
    expect(await role()).toBe("owner");
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).isActive).toBe(true);

    // Echoing the stored values changes nothing, so the demotion alone goes through.
    const echoed = await updateUser({ email, role: "member", name: "Owner", isActive: true }, org.id);
    expect(echoed.ok).toBe(true);
    expect(await role()).toBe("member");
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
