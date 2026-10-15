import { beforeEach, describe, expect, test, vi } from "vitest";
import { Prisma } from "@formbricks/database/prisma";
import { readDatabaseClock } from "@/lib/utils/database-clock";
import { restartSurveyRetention } from "./retention-restart";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/utils/database-clock", () => ({ readDatabaseClock: vi.fn() }));

/**
 * Against a real database (the marker only moving forward, which policies exempt, an active exemption
 * kept, an ended one closed) this is proven in `retention-restart.integration.test.ts`. These pin the
 * statements and what they are given.
 */
const statement = (args: unknown[]) => {
  const [strings, ...values] = args as [TemplateStringsArray, ...unknown[]];
  const sql = Prisma.sql(strings, ...values);
  return { text: sql.sql.replace(/\s+/g, " "), values: sql.values };
};

const NOW = new Date("2030-01-01T00:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;

const transaction = ({
  policy,
  inserted,
  byPolicy = true,
}: {
  policy?: { periodDays: number };
  inserted?: { id: string };
  byPolicy?: boolean;
}) => {
  const tx = {
    $executeRaw: vi.fn().mockResolvedValue(1),
    $queryRaw: vi.fn(async (...args: unknown[]) => {
      const { text } = statement(args);
      if (text.includes('AS "byPolicy"')) return [{ byPolicy }];
      if (text.includes('FROM "RetentionPolicy"')) return policy ? [policy] : [];
      if (text.includes('INSERT INTO "RetentionExemption"')) return inserted ? [inserted] : [];
      return [];
    }),
  };
  return tx;
};

const restart = (tx: ReturnType<typeof transaction>, restoredById: string | null = "cluser") =>
  restartSurveyRetention(tx as unknown as Prisma.TransactionClient, {
    surveyId: "clsrv",
    organizationId: "clorg",
    restoredById,
  });

describe("restartSurveyRetention", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(readDatabaseClock).mockResolvedValue(NOW);
  });

  test("restarts nothing for a survey the policy didn't archive since its last restore", async () => {
    const tx = transaction({ policy: { periodDays: 30 }, inserted: { id: "clexm" }, byPolicy: false });

    await expect(restart(tx)).resolves.toEqual({ exemptionId: null });

    const check = statement(tx.$queryRaw.mock.calls[0]);
    expect(check.text).toContain(`i."action" = 'archived'`);
    expect(check.text).toContain(`r."kind" = 'sweep'`);
    expect(check.text).toContain('r."startedAt" > COALESCE(');
    expect(tx.$executeRaw).not.toHaveBeenCalled();
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
  });

  test("records the restore on the database clock, moving it only forward", async () => {
    const tx = transaction({});

    await expect(restart(tx)).resolves.toEqual({ exemptionId: null });

    const marker = statement(tx.$executeRaw.mock.calls[0]);
    expect(marker.text).toContain('INSERT INTO "RetentionSurveyRestore"');
    expect(marker.text).toContain("GREATEST");
    expect(marker.values).toEqual(["clsrv", NOW]);
  });

  test("reads only an enabled surveys policy whose only condition is 'created before', held FOR SHARE", async () => {
    const tx = transaction({});

    await restart(tx);

    const policy = statement(tx.$queryRaw.mock.calls[1]);
    expect(policy.text).toContain(`"entity" = 'surveys' AND "enabled"`);
    expect(policy.text).toContain(`"conditions" = ARRAY['createdBefore']::"RetentionSurveyCondition"[]`);
    expect(policy.text).toContain("FOR SHARE");
    expect(policy.values).toEqual(["clorg"]);
    // No such policy: no exemption is touched.
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
  });

  test("closes an ended exemption, then exempts the survey for one period as the restorer", async () => {
    const tx = transaction({ policy: { periodDays: 30 }, inserted: { id: "clexm" } });

    await expect(restart(tx)).resolves.toEqual({ exemptionId: "clexm" });

    const close = statement(tx.$executeRaw.mock.calls[1]);
    expect(close.text).toContain('SET "revokedAt" = "until"');
    expect(close.values).toEqual(["clsrv", NOW]);

    const insert = statement(tx.$queryRaw.mock.calls[2]);
    expect(insert.text).toContain(`'surveys'`);
    expect(insert.text).toContain(`'restore'`);
    expect(insert.text).toContain(`ON CONFLICT ("surveyId", "entity") WHERE "revokedAt" IS NULL DO NOTHING`);
    expect(insert.values).toEqual([
      expect.any(String),
      NOW,
      "clorg",
      "clsrv",
      new Date(NOW.getTime() + 30 * DAY),
      "cluser",
    ]);
  });

  test("keeps an active exemption: the insert does nothing and none is reported", async () => {
    const tx = transaction({ policy: { periodDays: 30 } });

    await expect(restart(tx, null)).resolves.toEqual({ exemptionId: null });
    expect(statement(tx.$queryRaw.mock.calls[2]).values.at(-1)).toBeNull();
  });
});
