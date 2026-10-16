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
