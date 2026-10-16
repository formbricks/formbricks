import { describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { DISPLAY_STATUS_CASES, DISPLAY_STATUS_NOW } from "./display-status-cases";
import { creativeDisplayStatusSql } from "./display-status-sql";

/**
 * The SQL twin against a real PostgreSQL, over the same case table the TS derivation answers to.
 *
 * The rows are a `VALUES` list rather than `Creative` rows, so the check needs no fixture and covers the
 * expression alone. Timestamps are cast the way Prisma stores a `DateTime` (UTC, `timestamp(3)` without a
 * zone) and the instant is bound as a parameter, exactly as the list query binds it.
 */

const timestamp = (value: Date | null): Prisma.Sql =>
  value ? Prisma.sql`${value.toISOString()}::timestamp(3)` : Prisma.sql`NULL::timestamp(3)`;

describe("creativeDisplayStatusSql", () => {
  test("derives the same status as getCreativeDisplayState for every case", async () => {
    const rows = DISPLAY_STATUS_CASES.map(
      ({ input }, index) =>
        Prisma.sql`(${index}::int, ${input.status}::text, ${timestamp(input.archivedAt)}, ${timestamp(
          input.startAt
        )}, ${timestamp(input.endAt)}, ${input.destinationSurvey?.status ?? null}::text, ${timestamp(
          input.destinationSurvey?.archivedAt ?? null
        )})`
    );

    const derived = creativeDisplayStatusSql(
      {
        status: Prisma.raw('c."status"'),
        archivedAt: Prisma.raw('c."archivedAt"'),
        startAt: Prisma.raw('c."startAt"'),
        endAt: Prisma.raw('c."endAt"'),
        surveyStatus: Prisma.raw('c."surveyStatus"'),
        surveyArchivedAt: Prisma.raw('c."surveyArchivedAt"'),
      },
      DISPLAY_STATUS_NOW
    );

    const result = await prisma.$queryRaw<{ index: number; displayStatus: string }[]>`
      SELECT c."index", ${derived} AS "displayStatus"
      FROM (VALUES ${Prisma.join(rows)}) AS c("index", "status", "archivedAt", "startAt", "endAt", "surveyStatus", "surveyArchivedAt")
      ORDER BY c."index"
    `;

    expect(
      result.map(({ index, displayStatus }) => [DISPLAY_STATUS_CASES[index].name, displayStatus])
    ).toEqual(DISPLAY_STATUS_CASES.map(({ name, expected }) => [name, expected.status]));
  });
});
