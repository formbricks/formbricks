import { beforeEach, describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
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

  test("resolves a default-named composite key from the constraint name (adapter-pg 7.10+)", async () => {
    const organization = await prisma.organization.create({ data: { name: "ENG-3285 constraint name" } });
    await prisma.workspace.create({ data: { name: "Duplicate", organizationId: organization.id } });

    const error = await prisma.workspace
      .create({ data: { name: "Duplicate", organizationId: organization.id } })
      .catch((e) => e);

    expect(error?.code).toBe("P2002");
    // The premise (prisma#29587): from 7.10 the adapter reports the constraint name and table, and
    // no longer passes the column list through.
    const cause = (
      error?.meta as {
        driverAdapterError?: { cause?: { constraint?: Record<string, unknown>; table?: unknown } };
      }
    )?.driverAdapterError?.cause;
    expect(cause?.constraint).toEqual({ index: "Workspace_organizationId_name_key" });
    expect(cause?.table).toBe("Workspace");

    // Callers that only read fields[0] (action classes) depend on the order being preserved.
    expect(getUniqueConstraintFields(error)).toEqual(["organizationId", "name"]);
  });

  test("resolves a composite primary key from the explicit map (TagsOnResponses)", async () => {
    const organization = await prisma.organization.create({ data: { name: "ENG-3285 tags" } });
    const workspace = await prisma.workspace.create({
      data: { name: "ENG-3285 Workspace", organizationId: organization.id },
    });
    const survey = await prisma.survey.create({
      data: { name: "ENG-3285 Survey", workspaceId: workspace.id },
    });
    const response = await prisma.response.create({ data: { surveyId: survey.id, data: {} } });
    const tag = await prisma.tag.create({ data: { name: "ENG-3285", workspaceId: workspace.id } });
    await prisma.tagsOnResponses.create({ data: { responseId: response.id, tagId: tag.id } });

    const error = await prisma.tagsOnResponses
      .create({ data: { responseId: response.id, tagId: tag.id } })
      .catch((e) => e);

    expect(error?.code).toBe("P2002");
    expect(getUniqueConstraintFields(error)).toEqual(["responseId", "tagId"]);
  });

  /**
   * Drift guard. The 7.10 shape only carries the constraint name, so the helper resolves columns from
   * Prisma's default naming rule plus an explicit map for the names that rule cannot round-trip. This
   * checks that resolution against every unique index in the migrated schema: an index added with an
   * underscore column, a composite primary key, a custom `map:` or a name past Postgres's 63-byte
   * limit fails here until it gets a map entry, instead of resolving to the wrong columns in prod.
   */
  test("resolves the exact columns of every unique index in the schema", async () => {
    const indexes = await prisma.$queryRaw<{ table: string; index: string; columns: string[] }[]>`
      SELECT t.relname AS "table",
             i.relname AS "index",
             ARRAY(
               SELECT a.attname::text
               FROM unnest(ix.indkey) WITH ORDINALITY AS k(attnum, ord)
               JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k.attnum
               ORDER BY k.ord
             ) AS "columns"
      FROM pg_index ix
      JOIN pg_class i ON i.oid = ix.indexrelid
      JOIN pg_class t ON t.oid = ix.indrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = current_schema() AND ix.indisunique
      ORDER BY 1, 2
    `;

    // Sanity: the query found the schema rather than vacuously passing on an empty result.
    expect(indexes.length).toBeGreaterThan(50);

    const resolve = (index: string, table: string) =>
      getUniqueConstraintFields(
        new Prisma.PrismaClientKnownRequestError("duplicate", {
          code: "P2002",
          clientVersion: "test",
          meta: { driverAdapterError: { cause: { constraint: { index }, table } } },
        })
      );

    const mismatches = indexes
      .map(({ table, index, columns }) => ({ index, expected: columns, actual: resolve(index, table) }))
      .filter(({ expected, actual }) => JSON.stringify(expected) !== JSON.stringify(actual));

    expect(mismatches).toEqual([]);
  });
});
