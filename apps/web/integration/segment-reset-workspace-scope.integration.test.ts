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

const OTHER_FILTERS = attributeFilters("other@example.com");

let ownWorkspaceId: string;
let otherWorkspaceId: string;
let surveyId: string;

/** Creates an organization with one workspace and returns the workspace's id. */
const createWorkspaceInNewOrganization = async (name: string) => {
  const organization = await prisma.organization.create({ data: { name: `${name} Org` } });
  return (await prisma.workspace.create({ data: { name, organizationId: organization.id } })).id;
};

/** A private segment titled with the survey's id, as the survey's own targeting segment would be. */
const createPrivateSegmentTitledWithSurveyId = (workspaceId: string, filters: TBaseFilters) =>
  prisma.segment.create({ data: { title: surveyId, isPrivate: true, filters, workspaceId } });

const loadSurveySegment = async () =>
  (
    await prisma.survey.findUniqueOrThrow({
      where: { id: surveyId },
      select: { segment: { select: { id: true, workspaceId: true, isPrivate: true, filters: true } } },
    })
  ).segment;

const expectOtherSegmentUntouched = async (otherSegmentId: string) => {
  const otherSegment = await prisma.segment.findUniqueOrThrow({
    where: { id: otherSegmentId },
    include: { surveys: { select: { id: true } } },
  });
  expect(otherSegment.filters).toEqual(OTHER_FILTERS);
  expect(otherSegment.surveys).toEqual([]);
};

beforeEach(async () => {
  await resetDb();
  ownWorkspaceId = await createWorkspaceInNewOrganization("Own");
  otherWorkspaceId = await createWorkspaceInNewOrganization("Other");

  // The app survey runs on a shared segment of its own workspace, which is the state the editor's
  // "Reset all filters" button is shown in. Loading that segment deleted the survey's private one.
  const sharedSegment = await prisma.segment.create({
    data: {
      title: "Shared segment",
      isPrivate: false,
      filters: attributeFilters("customer@example.com"),
      workspaceId: ownWorkspaceId,
    },
  });
  surveyId = (
    await prisma.survey.create({
      data: {
        name: "App survey",
        type: "app",
        status: "inProgress",
        workspaceId: ownWorkspaceId,
        segmentId: sharedSegment.id,
      },
      select: { id: true },
    })
  ).id;
});

describe("resetSegmentInSurvey (ENG-7389)", () => {
  test("never connects the survey to a same-titled private segment in another workspace", async () => {
    const otherSegment = await createPrivateSegmentTitledWithSurveyId(otherWorkspaceId, OTHER_FILTERS);

    const result = await resetSegmentInSurvey(surveyId);

    expect(result.id).not.toBe(otherSegment.id);
    expect(result.workspaceId).toBe(ownWorkspaceId);
    expect(result.title).toBe(surveyId);
    expect(result.isPrivate).toBe(true);
    expect(result.filters).toEqual([]);
    expect(await loadSurveySegment()).toEqual({
      id: result.id,
      workspaceId: ownWorkspaceId,
      isPrivate: true,
      filters: [],
    });
    await expectOtherSegmentUntouched(otherSegment.id);
  });

  test("picks the survey's own private segment when another workspace holds one with the same title", async () => {
    // The other workspace's row is the older one, so an unscoped lookup usually returns it (Postgres doesn't
    // guarantee the order; the test above is the deterministic regression check). This one covers the
    // branch that reuses the survey's own private segment.
    const otherSegment = await createPrivateSegmentTitledWithSurveyId(otherWorkspaceId, OTHER_FILTERS);
    const ownSegment = await createPrivateSegmentTitledWithSurveyId(
      ownWorkspaceId,
      attributeFilters("own@example.com")
    );

    const result = await resetSegmentInSurvey(surveyId);

    expect(result.id).toBe(ownSegment.id);
    expect(result.filters).toEqual([]);
    expect((await loadSurveySegment())?.id).toBe(ownSegment.id);
    await expectOtherSegmentUntouched(otherSegment.id);
  });
});
