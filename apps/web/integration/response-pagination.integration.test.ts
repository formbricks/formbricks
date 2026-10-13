import { beforeEach, describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";
import { resetDb } from "@/integration/reset-db";
import { whereAfterResponseCursor } from "@/lib/response/pagination";

/**
 * The response batch cursor against real Postgres.
 *
 * The unit suites page through an in-memory stand-in for Prisma, so they cannot show that the SQL
 * Prisma generates selects the same rows, that `createdAt` survives the round trip through the cursor
 * exactly (millisecond precision, so ties still compare equal), or that a cursor row deleted between
 * batches leaves the next batch intact.
 */

const at = (minute: number) => new Date(Date.UTC(2026, 0, 1, 0, minute, 0, 123));

// Ids follow insertion order but createdAt does not, as with imported responses, and b, d and f share
// one timestamp.
const ROWS = [
  { id: "resp-a", createdAt: at(1) },
  { id: "resp-b", createdAt: at(5) },
  { id: "resp-c", createdAt: at(3) },
  { id: "resp-d", createdAt: at(5) },
  { id: "resp-e", createdAt: at(2) },
  { id: "resp-f", createdAt: at(5) },
  { id: "resp-g", createdAt: at(4) },
];

/** ROWS in the batch loops' order, `createdAt desc, id desc`. */
const SORTED_IDS = ["resp-f", "resp-d", "resp-b", "resp-g", "resp-c", "resp-e", "resp-a"];

let surveyId: string;

const seed = async (): Promise<void> => {
  const organization = await prisma.organization.create({ data: { name: "Paging Org" } });
  const workspace = await prisma.workspace.create({
    data: { name: "Paging Workspace", organizationId: organization.id },
  });
  const survey = await prisma.survey.create({
    data: { name: "Paging Survey", type: "link", status: "inProgress", workspaceId: workspace.id },
    select: { id: true },
  });
  surveyId = survey.id;

  await prisma.response.createMany({
    data: ROWS.map((row) => ({ ...row, surveyId, finished: true, data: {} })),
  });
};

/** Ids of the survey's responses after the cursor row, in the batch loops' order. */
const idsAfter = async (cursor: { id: string; createdAt: Date }): Promise<string[]> => {
  const rows = await prisma.response.findMany({
    where: whereAfterResponseCursor({ surveyId }, cursor),
    select: { id: true },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
  return rows.map((row) => row.id);
};

beforeEach(async () => {
  await resetDb();
  await seed();
});

describe("whereAfterResponseCursor", () => {
  test.each(SORTED_IDS.map((id, index) => [id, index] as const))(
    "selects exactly the responses sorted after %s, ties on createdAt included",
    async (cursorId, index) => {
      const cursor = await prisma.response.findUniqueOrThrow({
        where: { id: cursorId },
        select: { id: true, createdAt: true },
      });

      expect(await idsAfter(cursor)).toEqual(SORTED_IDS.slice(index + 1));
    }
  );

  test("still selects the responses after the cursor once the cursor row is deleted", async () => {
    const cursor = await prisma.response.delete({
      where: { id: "resp-b" },
      select: { id: true, createdAt: true },
    });

    expect(await idsAfter(cursor)).toEqual(["resp-g", "resp-c", "resp-e", "resp-a"]);
  });
});
