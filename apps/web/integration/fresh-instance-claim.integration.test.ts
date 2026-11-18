import { beforeEach, describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";
import { BootstrapAdminMarker } from "@formbricks/database/prisma";
import { resetDb } from "@/integration/reset-db";
import {
  getIsEligibleFirstOrganizationOwner,
  getIsFreshInstance,
  markInstanceSetupCompleted,
} from "@/lib/instance/service";

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

  test("a user created by the sign-up flow keeps the instance closed even if they leave before any page asks", async () => {
    await createUser("admin", BootstrapAdminMarker.bootstrapAdmin);
    await markInstanceSetupCompleted();
    await prisma.user.deleteMany();

    expect(await getIsFreshInstance()).toBe(false);
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
