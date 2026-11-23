import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import type { TFeedbackSourceWithMappings } from "@formbricks/types/feedback-source";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { resetDb } from "@/integration/reset-db";
import { importHistoricalResponses } from "@/lib/feedback-source/import";

/**
 * The historical import's paging against real Postgres (ENG-2374).
 *
 * `response-pagination.integration.test.ts` proves the cursor condition itself. This proves the import
 * loop over it: the real `getResponses` query, with the cursor ANDed onto completedOnly's `finished`
 * filter (which the unit suite's in-memory stand-in ignores), while responses are deleted and created
 * between pages. The Hub side is stubbed: each response the import hands to the transform is
 * recorded, which is what this suite checks.
 */

const transformed: string[] = [];
let betweenPages: (() => Promise<void>) | undefined;

vi.mock("@/lib/feedback-source/transform", () => ({
  transformResponseToFeedbackRecords: (response: { id: string }) => {
    transformed.push(response.id);
    return [{ submission_id: response.id }];
  },
}));

vi.mock("@/lib/feedback-source/reconcile", () => ({
  reconcileFeedbackRecords: async (records: unknown[]) => {
    const change = betweenPages;
    betweenPages = undefined;
    await change?.();
    return { created: records.length, reconciled: 0, superseded: 0, failures: [] };
  },
}));

const START = Date.UTC(2025, 0, 1);
const secondsAfterStart = (seconds: number) => new Date(START + seconds * 1000);

// 130 responses: three pages of 50. Prisma assigns ids in insertion order; createdAt is backdated in
// another order and every timestamp is shared by two responses.
// Every fifth response is unfinished, which completedOnly leaves out.
const RESPONSE_COUNT = 130;

const createSurvey = async (): Promise<{ surveyId: string; workspaceId: string }> => {
  const organization = await prisma.organization.create({ data: { name: "Import Org" } });
  const workspace = await prisma.workspace.create({
    data: { name: "Import Workspace", organizationId: organization.id },
  });
  const survey = await prisma.survey.create({
    data: { name: "Import Survey", type: "link", status: "inProgress", workspaceId: workspace.id },
    select: { id: true },
  });
  return { surveyId: survey.id, workspaceId: workspace.id };
};

const feedbackSourceFor = (
  workspaceId: string,
  surveyId: string,
  importMode: TFeedbackSourceWithMappings["importMode"]
): TFeedbackSourceWithMappings => ({
  id: "clfeedbacksource00000000",
  createdAt: new Date(START),
  updatedAt: new Date(START),
  name: "Import Source",
  type: "formbricks_survey",
  status: "active",
  importMode,
  elementScope: "specific",
  workspaceId,
  feedbackDirectoryId: "clfeedbackdirectory00000",
  lastSyncAt: null,
  createdBy: null,
  creatorName: null,
  formbricksMappings: [
    {
      id: "clfeedbackmapping0000000",
      createdAt: new Date(START),
      feedbackSourceId: "clfeedbacksource00000000",
      workspaceId,
      surveyId,
      elementId: "el-1",
      hubFieldType: "text",
      customFieldLabel: null,
    },
  ],
  fieldMappings: [],
});

describe("importHistoricalResponses over a survey that changes mid-import", () => {
  let surveyId: string;
  let workspaceId: string;
  let survey: TSurvey;

  /** The survey's responses in the import's order, `createdAt desc, id desc`. */
  const idsNewestFirst = async (where: { finished?: boolean } = {}) =>
    (
      await prisma.response.findMany({
        where: { surveyId, ...where },
        select: { id: true },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      })
    ).map((response) => response.id);

  beforeEach(async () => {
    await resetDb();
    transformed.length = 0;
    betweenPages = undefined;
    ({ surveyId, workspaceId } = await createSurvey());
    survey = { id: surveyId, blocks: [] } as unknown as TSurvey;
    await prisma.response.createMany({
      data: Array.from({ length: RESPONSE_COUNT }, (_, i) => ({
        surveyId,
        finished: i % 5 !== 0,
        data: {},
        createdAt: secondsAfterStart((i * 37) % (RESPONSE_COUNT / 2)),
      })),
    });
  });

  // Each change alone: together, a deletion and an arrival cancel out under an offset.
  test.each([
    {
      change: "a response the first page published is deleted",
      // completedOnly, so the cursor is ANDed with the `finished` filter.
      importMode: "completedOnly" as const,
      // Every later row moves up a place.
      apply: async (expected: string[]) => {
        await prisma.response.delete({ where: { id: expected[3] } });
      },
    },
    {
      change: "a new response arrives",
      importMode: "all" as const,
      // It sorts first and pushes every row down a place. The live pipeline sends it, not the import.
      apply: async () => {
        await prisma.response.create({ data: { surveyId, finished: true, data: {}, createdAt: new Date() } });
      },
    },
  ])("imports every response once when $change ($importMode)", async ({ importMode, apply }) => {
    const expected = await idsNewestFirst(importMode === "completedOnly" ? { finished: true } : {});
    betweenPages = () => apply(expected);

    const result = await importHistoricalResponses(
      feedbackSourceFor(workspaceId, surveyId, importMode),
      survey
    );

    expect(transformed).toEqual(expected);
    expect(result).toEqual({ successes: expected.length, failures: 0, skipped: 0 });
  });
});
