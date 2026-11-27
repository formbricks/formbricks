import { beforeEach, describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";
import { BootstrapAdminMarker } from "@formbricks/database/prisma";
import { resetDb } from "@/integration/reset-db";
import {
  getIsEligibleFirstOrganizationOwner,
  getIsFreshInstance,
  markInstanceSetupCompleted,
} from "@/lib/instance/service";
import { createOrganizationIfNoneExists } from "@/lib/organization/service";

/**
 * ENG-7313, against real Postgres.
 *
 * "Fresh" used to be `user.count() === 0`, so deleting the last user re-armed the unauthenticated
 * administrator sign-up. A mocked count cannot tell the fixed code from the broken code here: the
 * defect is what happens to the state AFTER a user has existed and is gone.
 */
beforeEach(async () => {
  await resetDb();
});

const createUser = (id: string, isBootstrapAdmin?: BootstrapAdminMarker) =>
  prisma.user.create({ data: { id, name: id, email: `${id}@example.com`, isBootstrapAdmin } });

describe("getIsFreshInstance (real Postgres)", () => {
  test("an empty database is fresh and stays unmarked", async () => {
    expect(await getIsFreshInstance()).toBe(true);
    expect(await prisma.instanceSetup.count()).toBe(0);
  });

  test("is not fresh once a user exists, and records that setup happened", async () => {
    await createUser("admin");

    expect(await getIsFreshInstance()).toBe(false);
    expect(await prisma.instanceSetup.count()).toBe(1);
  });

  test("does NOT become fresh again when the last user is deleted", async () => {
    await createUser("admin");
    expect(await getIsFreshInstance()).toBe(false);

    await prisma.user.deleteMany();
    expect(await prisma.user.count()).toBe(0);

    expect(await getIsFreshInstance()).toBe(false);
  });

  test("a marker written by the migration backfill keeps an emptied instance closed", async () => {
    await prisma.instanceSetup.create({ data: {} });

    expect(await prisma.user.count()).toBe(0);
    expect(await getIsFreshInstance()).toBe(false);
  });

  // `createSignup` and the SSO after-hook call `markInstanceSetupCompleted` once the first user exists;
  // their own unit tests pin that call. This pins what the call buys.
  test("the marker written for the first user keeps the instance closed even if they leave before any page asks", async () => {
    await createUser("admin", BootstrapAdminMarker.bootstrapAdmin);
    await markInstanceSetupCompleted();
    await prisma.user.deleteMany();

    expect(await getIsFreshInstance()).toBe(false);
  });

  // The fallback for a database built with `db:push` or restored from before the migration: an
  // organization without users is still not a fresh instance.
  test("an organization without users keeps the instance set up", async () => {
    await prisma.organization.create({ data: { id: "org-1", name: "Acme" } });

    expect(await prisma.user.count()).toBe(0);
    expect(await getIsFreshInstance()).toBe(false);
    expect(await prisma.instanceSetup.count()).toBe(1);
  });

  // The race the smoke test hit as a 500: several renders, or a sign-up and a page, writing the first
  // marker at once. Prisma's `upsert` with an empty update is not a native upsert and raised a
  // unique-constraint error here (hundreds of failures over these rounds before the fix).
  test("concurrent first marker writes all succeed and leave one row", async () => {
    for (let round = 0; round < 5; round++) {
      await prisma.instanceSetup.deleteMany();

      const results = await Promise.allSettled(
        Array.from({ length: 50 }, () => markInstanceSetupCompleted())
      );

      expect(results.filter((result) => result.status === "rejected")).toEqual([]);
      expect(await prisma.instanceSetup.count()).toBe(1);
    }
  });

  test("the marker is a singleton", async () => {
    await prisma.instanceSetup.create({ data: {} });
    await expect(prisma.instanceSetup.create({ data: {} })).rejects.toThrow();
  });
});

describe("getIsEligibleFirstOrganizationOwner (real Postgres)", () => {
  test("the bootstrap administrator is eligible even when other users exist", async () => {
    await createUser("admin", BootstrapAdminMarker.bootstrapAdmin);
    await createUser("other");

    expect(await getIsEligibleFirstOrganizationOwner("admin")).toBe(true);
  });

  test("the sole user of the instance is eligible without a marker (pre-marker instances)", async () => {
    await createUser("only");

    expect(await getIsEligibleFirstOrganizationOwner("only")).toBe(true);
  });

  test("an unmarked user is not eligible once another user exists", async () => {
    await createUser("admin", BootstrapAdminMarker.bootstrapAdmin);
    await createUser("intruder");

    expect(await getIsEligibleFirstOrganizationOwner("intruder")).toBe(false);
  });

  // An instance whose administrator predates the bootstrap marker (ENG-2247), with a second user and no
  // organization left: exactly one user, the earliest, can still create it.
  test("without a bootstrap administrator, only the earliest-created user is eligible", async () => {
    await prisma.user.create({
      data: { id: "first", name: "first", email: "first@example.com", createdAt: new Date("2025-01-01") },
    });
    await prisma.user.create({
      data: { id: "later", name: "later", email: "later@example.com", createdAt: new Date("2025-06-01") },
    });

    expect(await getIsEligibleFirstOrganizationOwner("first")).toBe(true);
    expect(await getIsEligibleFirstOrganizationOwner("later")).toBe(false);
  });

  test("an unknown user id is not eligible", async () => {
    await createUser("admin");

    expect(await getIsEligibleFirstOrganizationOwner("ghost")).toBe(false);
  });
});

describe("createOrganizationIfNoneExists (real Postgres)", () => {
  // Two first-organization claims that both passed "are there no organizations yet?" used to create two
  // organizations on a single-organization instance. The check and the insert now share a lock.
  test("concurrent claims create exactly one organization", async () => {
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, index) => createOrganizationIfNoneExists({ name: `Claim ${index}` }))
    );

    expect(results.filter((organization) => organization !== null)).toHaveLength(1);
    expect(await prisma.organization.count()).toBe(1);
  });

  test("creates nothing once an organization exists", async () => {
    await prisma.organization.create({ data: { id: "org-1", name: "Acme" } });

    expect(await createOrganizationIfNoneExists({ name: "Second" })).toBeNull();
    expect(await prisma.organization.count()).toBe(1);
  });
});
