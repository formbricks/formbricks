import { beforeEach, describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";
import { resetDb } from "@/integration/reset-db";
import {
  RetentionPolicyInvalidError,
  getRetentionPolicyRows,
  resolveRetentionPolicySettings,
  updateRetentionPolicy,
} from "./policies-service";
import { RETENTION_POLICY_DEFAULTS } from "./policy-rules";

const DAY = 24 * 60 * 60 * 1000;
const T0 = new Date("2030-01-01T00:00:00.000Z");
const at = (days: number) => new Date(T0.getTime() + days * DAY);

describe("retention policies service (real Postgres)", () => {
  let organizationId: string;
  let userId: string;

  const update = (
    patch: Parameters<typeof updateRetentionPolicy>[0]["patch"],
    now = T0,
    policy = "surveys" as const
  ) => updateRetentionPolicy({ organizationId, policy, patch, updatedById: userId, now });

  const stored = () =>
    prisma.retentionPolicy.findUniqueOrThrow({
      where: { organizationId_entity: { organizationId, entity: "surveys" } },
    });

  beforeEach(async () => {
    await resetDb();
    organizationId = (await prisma.organization.create({ data: { name: "Retention Org" } })).id;
    userId = (await prisma.user.create({ data: { name: "Anna", email: "anna@example.com" } })).id;
  });

  test("reads never-saved policies as their defaults, switched off", async () => {
    expect(resolveRetentionPolicySettings(await getRetentionPolicyRows(organizationId))).toEqual(
      RETENTION_POLICY_DEFAULTS
    );
  });

  test("saves the first change over the defaults and starts the warning when switched on", async () => {
    const result = await update({ enabled: true, warnDays: 30 });

    expect(result).toMatchObject({ previous: RETENTION_POLICY_DEFAULTS.surveys, changed: true });
    expect(await stored()).toMatchObject({
      enabled: true,
      enabledAt: T0,
      warnDays: 30,
      archiveDays: 1095,
      deleteDays: 30,
      conditions: ["noResponse", "noChange"],
      updatedById: userId,
    });
  });

  test("restarts the warning on a shorter period, keeps it on a longer one or while paused", async () => {
    await update({ enabled: true });

    await update({ archiveDays: 1825 }, at(10));
    expect((await stored()).enabledAt).toEqual(T0);

    await update({ archiveDays: 365 }, at(20));
    expect((await stored()).enabledAt).toEqual(at(20));

    await update({ enabled: false, archiveDays: 90 }, at(30));
    expect((await stored()).enabledAt).toEqual(at(20));

    await update({ enabled: true }, at(40));
    expect((await stored()).enabledAt).toEqual(at(40));
  });

  test("writes nothing, not even a first row, when the result breaks a rule", async () => {
    const error = await update({ enabled: true, deleteDays: 60, warnDays: 10 }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(RetentionPolicyInvalidError);
    expect((error as RetentionPolicyInvalidError).issues.map((issue) => issue.field).sort()).toEqual([
      "deleteDays",
      "warnDays",
    ]);
    expect(await getRetentionPolicyRows(organizationId)).toEqual([]);
  });

  test("reports a change that leaves the policy as it was, and doesn't touch the row", async () => {
    await update({ enabled: true });
    const before = await stored();

    const result = await update({ enabled: true, conditions: ["noChange", "noResponse"] }, at(5));

    expect(result.changed).toBe(false);
    expect((await stored()).updatedAt).toEqual(before.updatedAt);
  });

  test("keeps both of two concurrent first edits, neither overwriting the other", async () => {
    await Promise.all([update({ warnDays: 45 }), update({ conditions: ["createdBefore"] })]);

    expect(await stored()).toMatchObject({ warnDays: 45, conditions: ["createdBefore"] });
    expect(await getRetentionPolicyRows(organizationId)).toHaveLength(1);
  });

  test("serialises concurrent edits of a saved policy, so no edit is lost", async () => {
    await update({ enabled: true });

    // Each round races two edits of different fields; without the row lock both read the same old
    // settings and the later write puts the other field back.
    for (let round = 0; round < 10; round++) {
      const warnDays = 31 + round;
      const conditions = round % 2 === 0 ? (["createdBefore"] as const) : (["noResponse"] as const);
      await Promise.all([
        update({ warnDays }, at(round)),
        update({ conditions: [...conditions] }, at(round)),
      ]);
      expect(await stored()).toMatchObject({ warnDays, conditions: [...conditions] });
    }
  });

  test("stamps enabledAt from the database clock, read after the row lock, when no time is given", async () => {
    const before = (await prisma.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS "now"`)[0].now;
    await updateRetentionPolicy({
      organizationId,
      policy: "members",
      patch: { enabled: true },
      updatedById: userId,
    });
    const after = (await prisma.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS "now"`)[0].now;

    const { enabledAt } = await prisma.retentionPolicy.findUniqueOrThrow({
      where: { organizationId_entity: { organizationId, entity: "members" } },
    });
    expect(enabledAt!.getTime()).toBeGreaterThanOrEqual(before.getTime() - 1);
    // The column keeps milliseconds, so the stored value may round by one either way.
    expect(enabledAt!.getTime()).toBeLessThanOrEqual(after.getTime() + 1);
  });

  test("keeps each policy and organisation apart", async () => {
    const otherOrganizationId = (await prisma.organization.create({ data: { name: "Other" } })).id;
    await update({ enabled: true });
    await updateRetentionPolicy({
      organizationId: otherOrganizationId,
      policy: "members",
      patch: { archiveDays: 90 },
      updatedById: userId,
      now: T0,
    });

    const settings = resolveRetentionPolicySettings(await getRetentionPolicyRows(organizationId));
    expect(settings.surveys.enabled).toBe(true);
    expect(settings.members).toEqual(RETENTION_POLICY_DEFAULTS.members);
  });
});
