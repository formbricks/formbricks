import { beforeEach, describe, expect, test, vi } from "vitest";
import * as xlsx from "xlsx";
import { prisma } from "@formbricks/database";
import { type TResponseFilterCriteria } from "@formbricks/types/responses";
import { getSurveySummary } from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/(analysis)/summary/lib/surveySummary";
import { resetDb } from "@/integration/reset-db";
import { whereAfterResponseCursor } from "@/lib/response/pagination";
import { getResponseDownloadFile } from "@/lib/response/service";

/**
 * The response batch cursor against real Postgres.
 *
 * The unit suites page through an in-memory stand-in for Prisma, so they cannot show that the SQL
 * Prisma generates selects the same rows, that `createdAt` survives the round trip through the cursor
 * exactly (millisecond precision, so ties still compare equal), that a cursor row deleted between
 * batches leaves the next batch intact, or that the summary and the export agree on one data set.
 */

/**
 * The export asks the enterprise licence service whether to add a Quotas column, which a node test
 * cannot reach. Stubbed off so the export runs; the column has nothing to do with paging.
 */
vi.mock("@/modules/ee/license-check/lib/utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/ee/license-check/lib/utils")>()),
  getIsQuotasEnabled: async () => false,
}));

const createSurvey = async (): Promise<string> => {
  const organization = await prisma.organization.create({ data: { name: "Paging Org" } });
  const workspace = await prisma.workspace.create({
    data: { name: "Paging Workspace", organizationId: organization.id },
  });
  const survey = await prisma.survey.create({
    data: { name: "Paging Survey", type: "link", status: "inProgress", workspaceId: workspace.id },
    select: { id: true },
  });
  return survey.id;
};

describe("whereAfterResponseCursor", () => {
  const at = (minute: number) => new Date(Date.UTC(2026, 0, 1, 0, minute, 0, 123));

  // Ids follow insertion order but createdAt does not, as with imported responses, and b, d and f
  // share one timestamp.
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
    surveyId = await createSurvey();
    await prisma.response.createMany({
      data: ROWS.map((row) => ({ ...row, surveyId, finished: true, data: {} })),
    });
  });

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

describe("survey summary and response export over the same responses", () => {
  const START = Date.UTC(2025, 0, 1);
  const secondsAfterStart = (seconds: number) => new Date(START + seconds * 1000);

  // 7,200 responses: past the summary's 5,000-row batch and two of the export's 3,000-row batches.
  // Prisma assigns ids in insertion order, as in production; createdAt is backdated in a different
  // order, as with imported responses, and every timestamp is shared by three responses. Every sixth
  // response is unfinished.
  const RESPONSE_COUNT = 7200;

  // A date range keeping 6,303 responses, of which over 5,000 are finished, so the filtered summary
  // still needs a second batch.
  const FILTER_MIN = secondsAfterStart(200);
  const FILTER_MAX = secondsAfterStart(2300);
  const FILTER: TResponseFilterCriteria = { finished: true, createdAt: { min: FILTER_MIN, max: FILTER_MAX } };

  const sorted = (ids: string[]) => [...ids].sort((a, b) => a.localeCompare(b));

  let surveyId: string;

  const exportedIds = async (format: "csv" | "xlsx", filterCriteria?: TResponseFilterCriteria) => {
    const { fileContents } = await getResponseDownloadFile(surveyId, format, filterCriteria);
    const workbook =
      format === "xlsx"
        ? xlsx.read(fileContents, { type: "base64" })
        : xlsx.read(fileContents, { type: "string" });
    const rows = xlsx.utils.sheet_to_json<Record<string, string>>(workbook.Sheets[workbook.SheetNames[0]]);
    return rows.map((row) => row["Response ID"]);
  };

  beforeEach(async () => {
    await resetDb();
    surveyId = await createSurvey();
    const responses = Array.from({ length: RESPONSE_COUNT }, (_, i) => ({
      surveyId,
      finished: i % 6 !== 0,
      data: {},
      createdAt: secondsAfterStart((i * 7919) % (RESPONSE_COUNT / 3)),
    }));
    for (let i = 0; i < responses.length; i += 1000) {
      await prisma.response.createMany({ data: responses.slice(i, i + 1000) });
    }
  }, 60_000);

  test("count and export every response exactly once, with and without a filter", async () => {
    const all = await prisma.response.findMany({
      where: { surveyId },
      select: { id: true, finished: true, createdAt: true },
    });
    const allIds = sorted(all.map((response) => response.id));
    const filteredIds = sorted(
      all
        .filter(
          (response) =>
            response.finished && response.createdAt >= FILTER_MIN && response.createdAt <= FILTER_MAX
        )
        .map((response) => response.id)
    );
    expect(filteredIds.length).toBeGreaterThan(5000);

    const summary = await getSurveySummary(surveyId);
    expect(summary.meta.totalResponses).toBe(RESPONSE_COUNT);
    expect(summary.meta.completedResponses).toBe(RESPONSE_COUNT - RESPONSE_COUNT / 6);

    const filteredSummary = await getSurveySummary(surveyId, FILTER);
    expect(filteredSummary.meta.totalResponses).toBe(filteredIds.length);

    // One export at a time: the first one creates the organization's billing row, and concurrent
    // exports of a new organization race on that insert.
    expect(sorted(await exportedIds("csv"))).toEqual(allIds);
    expect(sorted(await exportedIds("xlsx"))).toEqual(allIds);
    expect(sorted(await exportedIds("csv", FILTER))).toEqual(filteredIds);
  }, 60_000);
});
