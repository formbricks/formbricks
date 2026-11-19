import { createId } from "@paralleldrive/cuid2";
import { beforeEach, describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";
import type { TBaseFilters } from "@formbricks/types/segment";
import { resetDb } from "@/integration/reset-db";
import { resetSegmentInSurvey } from "@/modules/ee/contacts/segments/lib/segments";

/**
 * ENG-7389 against real Postgres: "Reset all filters" finds the survey's private segment by its title, the
 * survey's id. Segment titles are only unique per workspace, so another organization can hold a private
 * segment with the same title. The unit suite mocks Prisma, so only a real database shows which row the
 * lookup picks and where the survey ends up connected.
 */

const attributeFilters = (value: string): TBaseFilters => [
  {
    id: createId(),
    connector: null,
    resource: {
      id: createId(),
      root: { type: "attribute", contactAttributeKey: "email" },
      value,
      qualifier: { operator: "equals" },
    },
  },
];

const ATTACKER_FILTERS = attributeFilters("attacker@example.com");

let victimWorkspaceId: string;
let attackerWorkspaceId: string;
let victimSurveyId: string;

const createWorkspace = async (name: string) => {
  const organization = await prisma.organization.create({ data: { name: `${name} Org` } });
  return (await prisma.workspace.create({ data: { name, organizationId: organization.id } })).id;
};

/** The attacker's private segment, titled with the victim's survey id, in the attacker's own workspace. */
const createAttackerSegment = () =>
  prisma.segment.create({
    data: {
      title: victimSurveyId,
      isPrivate: true,
      filters: ATTACKER_FILTERS,
      workspaceId: attackerWorkspaceId,
    },
  });

const surveySegment = async () =>
  (
    await prisma.survey.findUniqueOrThrow({
      where: { id: victimSurveyId },
      select: { segment: { select: { id: true, workspaceId: true, isPrivate: true, filters: true } } },
    })
  ).segment;

const expectAttackerSegmentUntouched = async (attackerSegmentId: string) => {
  const attackerSegment = await prisma.segment.findUniqueOrThrow({
    where: { id: attackerSegmentId },
    include: { surveys: { select: { id: true } } },
  });
  expect(attackerSegment.filters).toEqual(ATTACKER_FILTERS);
  expect(attackerSegment.surveys).toEqual([]);
};

beforeEach(async () => {
  await resetDb();
  victimWorkspaceId = await createWorkspace("Victim");
  attackerWorkspaceId = await createWorkspace("Attacker");

  // The victim's app survey runs on a shared segment of its own workspace, which is the state the editor's
  // "Reset all filters" button is shown in. Loading that segment deleted the survey's private one.
  const sharedSegment = await prisma.segment.create({
    data: {
      title: "Victim shared segment",
      isPrivate: false,
      filters: attributeFilters("customer@example.com"),
      workspaceId: victimWorkspaceId,
    },
  });
  victimSurveyId = (
    await prisma.survey.create({
      data: {
        name: "Victim survey",
        type: "app",
        status: "inProgress",
        workspaceId: victimWorkspaceId,
        segmentId: sharedSegment.id,
      },
      select: { id: true },
    })
  ).id;
});

describe("resetSegmentInSurvey (ENG-7389)", () => {
  test("never connects the survey to a same-titled private segment in another workspace", async () => {
    const attackerSegment = await createAttackerSegment();

    const result = await resetSegmentInSurvey(victimSurveyId);

    expect(result.id).not.toBe(attackerSegment.id);
    expect(result.workspaceId).toBe(victimWorkspaceId);
    expect(result.title).toBe(victimSurveyId);
    expect(result.isPrivate).toBe(true);
    expect(result.filters).toEqual([]);
    expect(await surveySegment()).toEqual({
      id: result.id,
      workspaceId: victimWorkspaceId,
      isPrivate: true,
      filters: [],
    });
    await expectAttackerSegmentUntouched(attackerSegment.id);
  });

  test("picks the survey's own private segment when another workspace holds one with the same title", async () => {
    // The attacker's row is the older one, so an unscoped lookup tends to return it first.
    const attackerSegment = await createAttackerSegment();
    const ownSegment = await prisma.segment.create({
      data: {
        title: victimSurveyId,
        isPrivate: true,
        filters: attributeFilters("victim@example.com"),
        workspaceId: victimWorkspaceId,
      },
    });

    const result = await resetSegmentInSurvey(victimSurveyId);

    expect(result.id).toBe(ownSegment.id);
    expect(result.filters).toEqual([]);
    expect((await surveySegment())?.id).toBe(ownSegment.id);
    await expectAttackerSegmentUntouched(attackerSegment.id);
  });
});
