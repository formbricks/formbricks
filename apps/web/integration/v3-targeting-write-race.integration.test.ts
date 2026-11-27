import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { patchV3Survey } from "@/app/api/v3/surveys/patch";
import { V3SurveyTargetingChangedError } from "@/app/api/v3/surveys/targeting";
import { resetDb } from "@/integration/reset-db";
import { selectSurvey } from "@/lib/survey/service";
import { transformPrismaSurvey } from "@/lib/survey/utils";

/**
 * ENG-7269: a v3 PATCH that changes targeting writes the survey's private segment, then the survey, in one
 * transaction. If another save moves the survey to a different segment between those two writes, the
 * PATCH must fail with 409 and its segment write must roll back. The interleaving is made deterministic by
 * running the other save, on its own connection, right after the PATCH's segment write.
 */

const hooks = vi.hoisted(() => ({ afterSegmentWrite: undefined as undefined | (() => Promise<void>) }));

vi.mock("@/app/api/v3/surveys/targeting", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/app/api/v3/surveys/targeting")>();
  return {
    ...original,
    setV3SurveySegmentFilters: async (...args: Parameters<typeof original.setV3SurveySegmentFilters>) => {
      await original.setV3SurveySegmentFilters(...args);
      await hooks.afterSegmentWrite?.();
    },
  };
});

// Targeting writes need the Contacts licence; its own tests cover that gate.
vi.mock("@/modules/ee/license-check/lib/utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/ee/license-check/lib/utils")>()),
  getIsContactsEnabled: async () => true,
}));

const BLOCKS = [
  {
    id: "clbk7269000000000000000001",
    name: "Main Block",
    elements: [
      {
        id: "satisfaction",
        type: "openText",
        headline: { default: "What should we improve?" },
        required: false,
        inputType: "text",
        charLimit: { enabled: false },
      },
    ],
  },
];

const STORED_FILTERS = [
  {
    id: "clfilter7269000000000000001",
    connector: null,
    resource: {
      id: "clresrc72690000000000000001",
      root: { type: "attribute", contactAttributeKey: "email" },
      qualifier: { operator: "equals" },
      value: "stored@example.com",
    },
  },
];

const loadSurvey = async (surveyId: string): Promise<TSurvey> =>
  transformPrismaSurvey<TSurvey>(
    await prisma.survey.findUniqueOrThrow({ where: { id: surveyId }, select: selectSurvey })
  );

let surveyId: string;
let ownSegmentId: string;
let sharedSegmentId: string;

beforeEach(async () => {
  await resetDb();
  hooks.afterSegmentWrite = undefined;
  const organization = await prisma.organization.create({ data: { name: "ENG-7269 race org" } });
  const workspace = await prisma.workspace.create({
    data: { name: "ENG-7269 race workspace", organizationId: organization.id },
  });
  surveyId = (
    await prisma.survey.create({
      data: { name: "App survey", type: "app", status: "draft", workspaceId: workspace.id, blocks: BLOCKS },
      select: { id: true },
    })
  ).id;
  ownSegmentId = (
    await prisma.segment.create({
      data: {
        title: surveyId,
        isPrivate: true,
        filters: STORED_FILTERS,
        workspaceId: workspace.id,
        surveys: { connect: { id: surveyId } },
      },
      select: { id: true },
    })
  ).id;
  sharedSegmentId = (
    await prisma.segment.create({
      data: { title: "Shared", isPrivate: false, filters: [], workspaceId: workspace.id },
      select: { id: true },
    })
  ).id;
});

describe("v3 PATCH targeting write vs a concurrent segment move (ENG-7269)", () => {
  test("a survey moved between the segment write and the survey update answers 409 and rolls back", async () => {
    const survey = await loadSurvey(surveyId);
    // The other save, on its own connection, lands after the PATCH's segment write.
    hooks.afterSegmentWrite = async () => {
      await prisma.survey.update({ where: { id: surveyId }, data: { segmentId: sharedSegmentId } });
    };

    await expect(
      patchV3Survey(survey, { targeting: { filters: [] } }, { requestId: "req_eng7269_race" })
    ).rejects.toBeInstanceOf(V3SurveyTargetingChangedError);

    // The PATCH's segment write rolled back with its transaction; the other save stands.
    expect((await prisma.segment.findUniqueOrThrow({ where: { id: ownSegmentId } })).filters).toEqual(
      STORED_FILTERS
    );
    expect((await prisma.survey.findUniqueOrThrow({ where: { id: surveyId } })).segmentId).toBe(
      sharedSegmentId
    );
  });

  test("without a concurrent move the same PATCH writes the survey's own segment", async () => {
    const survey = await loadSurvey(surveyId);

    await patchV3Survey(survey, { targeting: { filters: [] } }, { requestId: "req_eng7269_no_race" });

    expect((await prisma.segment.findUniqueOrThrow({ where: { id: ownSegmentId } })).filters).toEqual([]);
  });
});
