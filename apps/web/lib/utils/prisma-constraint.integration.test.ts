import { beforeEach, describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";
import { resetDb } from "@/integration/reset-db";
import { getUniqueConstraintFields } from "@/lib/utils/prisma-constraint";

/**
 * Locks the P2002 error shape against the REAL Prisma 7 + @prisma/adapter-pg stack (ENG-1801).
 *
 * The regression that motivated this shipped because the unit tests mocked a synthetic
 * `{ meta: { target: [...] } }` shape that the driver adapter never actually produces. This drives
 * genuine unique-constraint violations against real Postgres so a future Prisma/adapter upgrade that
 * changes the meta shape fails HERE instead of silently returning 500s in production.
 *
 * `getUniqueConstraintFields` reads `error.meta` structurally, so it is unaffected by which generated
 * client (the harness uses a separate test client) threw the error.
 */
beforeEach(async () => {
  await resetDb();
});

describe("getUniqueConstraintFields vs real Prisma 7 + adapter-pg (ENG-1801)", () => {
  test("recovers the column of an unmapped unique field (User.email) — and meta.target is absent", async () => {
    const email = "eng1801-integration@example.com";
    await prisma.user.create({ data: { name: "First", email } });

    const error = await prisma.user.create({ data: { name: "Second", email } }).catch((e) => e);

    expect(error?.code).toBe("P2002");
    // The regression premise: the driver adapter no longer populates meta.target.
    expect((error?.meta as { target?: unknown })?.target).toBeUndefined();
    expect(getUniqueConstraintFields(error)).toEqual(["email"]);
  });

  test("recovers the @map()-ed DB column name for a mapped unique field (PasswordResetToken.token_hash)", async () => {
    const [userA, userB] = await Promise.all([
      prisma.user.create({ data: { name: "A", email: "eng1801-a@example.com" } }),
      prisma.user.create({ data: { name: "B", email: "eng1801-b@example.com" } }),
    ]);
    const tokenHash = "eng1801-shared-token-hash";
    const expiresAt = new Date(Date.now() + 3_600_000);
    await prisma.passwordResetToken.create({ data: { userId: userA.id, tokenHash, expiresAt } });

    const error = await prisma.passwordResetToken
      .create({ data: { userId: userB.id, tokenHash, expiresAt } })
      .catch((e) => e);

    expect(error?.code).toBe("P2002");
    // The adapter reports the DB column name (`token_hash`), not the Prisma field name (`tokenHash`).
    expect(getUniqueConstraintFields(error)).toEqual(["token_hash"]);
  });

  test("unquotes camelCase columns, which Postgres quotes in the error DETAIL (ENG-2174)", async () => {
    const organization = await prisma.organization.create({ data: { name: "ENG-2174 quoting" } });
    await prisma.workspace.create({ data: { name: "Duplicate", organizationId: organization.id } });

    const error = await prisma.workspace
      .create({ data: { name: "Duplicate", organizationId: organization.id } })
      .catch((e) => e);

    expect(error?.code).toBe("P2002");
    // The premise: Postgres quotes any identifier that is not all-lowercase, and the adapter
    // regex-scrapes the DETAIL without unquoting — so the raw meta carries the quotes.
    const rawFields = (
      error?.meta as { driverAdapterError?: { cause?: { constraint?: { fields?: string[] } } } }
    )?.driverAdapterError?.cause?.constraint?.fields;
    expect(rawFields).toContain('"organizationId"');

    // ...and the helper hands back usable Prisma field names. Note `name` is lowercase and therefore
    // never quoted, which is why callers that only read fields[0] kept working by luck.
    expect(getUniqueConstraintFields(error)).toEqual(["organizationId", "name"]);
  });
});
