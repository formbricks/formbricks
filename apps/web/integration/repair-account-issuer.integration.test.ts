import { beforeEach, describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";
import { resetDb } from "@/integration/reset-db";
// The repair data migration under test (auto-discovered by the migration runner at deploy).
import { repairAccountIssuer } from "../../../packages/database/migration/20260821165535_repair_account_issuer/migration";

/**
 * Integration coverage for the ENG-2555 `Account.issuer` repair against real Postgres — the one piece
 * of that PR that was otherwise verified only by hand. The stakes are the same as the bug it repairs:
 * this migration is an independent transcription of the canonical provider→issuer mapping, so a drift
 * here (swap `IS DISTINCT FROM` for `<>`, drop the google arm) silently stops repairing rows while the
 * unit suite stays green. `constants.test.ts` pins the SQL text; this proves the SQL's behaviour.
 *
 * The runner supplies `run` with its interactive transaction; here `prisma` stands in, which is the
 * same shape the credential-backfill test uses for its migration.
 */
const runRepair = () => repairAccountIssuer.run!({ prisma, tx: prisma as never });

/** The seed matrix from the manual verification run — one row per repair class. */
const seedMatrix = async (): Promise<string> => {
  const user = await prisma.user.create({
    data: { email: "issuer-matrix@example.com", name: "Matrix", emailVerified: true },
  });
  await prisma.account.createMany({
    data: [
      // the ENG-2555 shape: google stomped with the synthetic form
      {
        userId: user.id,
        type: "oauth",
        provider: "google",
        providerAccountId: "g-sub",
        issuer: "local:oauth:google",
      },
      // already canonical — must stay byte-identical
      {
        userId: user.id,
        type: "oauth",
        provider: "github",
        providerAccountId: "gh-sub",
        issuer: "local:oauth:github",
      },
      {
        userId: user.id,
        type: "credential",
        provider: "credential",
        providerAccountId: user.id,
        issuer: "local:credential",
      },
      // pre-backfill leftover: NULL issuer (IS DISTINCT FROM must catch it, `<>` would not)
      { userId: user.id, type: "oauth", provider: "openid", providerAccountId: "oid-sub", issuer: null },
    ],
  });
  return user.id;
};

const issuersByProvider = async (userId: string): Promise<Record<string, string | null>> => {
  const rows = await prisma.account.findMany({
    where: { userId },
    select: { provider: true, issuer: true },
  });
  return Object.fromEntries(rows.map((r) => [r.provider, r.issuer]));
};

beforeEach(async () => {
  await resetDb();
});

describe("repairAccountIssuer data migration (real Postgres)", () => {
  test("repairs the stomped google row and the NULL row, leaves canonical rows untouched", async () => {
    const userId = await seedMatrix();

    await runRepair();

    expect(await issuersByProvider(userId)).toEqual({
      google: "https://accounts.google.com",
      github: "local:oauth:github",
      credential: "local:credential",
      openid: "local:oauth:openid",
    });
  });

  test("is idempotent: a second run changes nothing", async () => {
    const userId = await seedMatrix();
    await runRepair();
    const first = await issuersByProvider(userId);

    await runRepair();

    expect(await issuersByProvider(userId)).toEqual(first);
  });

  test("is a no-op on a database with no Account rows", async () => {
    await expect(runRepair()).resolves.toBeUndefined();
    expect(await prisma.account.count()).toBe(0);
  });

  /**
   * The repaired row must be findable under Better Auth's own key — the property the whole ticket is
   * about, asserted through the `@@unique([issuer, providerAccountId])` lookup 1.7 filters on.
   */
  test("a repaired google row resolves by Better Auth's (issuer, accountId) key", async () => {
    const userId = await seedMatrix();

    await runRepair();

    const found = await prisma.account.findUnique({
      where: {
        issuer_providerAccountId: { issuer: "https://accounts.google.com", providerAccountId: "g-sub" },
      },
      select: { userId: true },
    });
    expect(found?.userId).toBe(userId);
  });
});
