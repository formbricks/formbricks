import { createId } from "@paralleldrive/cuid2";
import { beforeEach, describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";
import { DatabaseError, InvalidInputError, ValidationError } from "@formbricks/types/errors";
import type { TBaseFilters } from "@formbricks/types/segment";
import { resetDb } from "@/integration/reset-db";
import { createSegment, updateSegment } from "@/modules/ee/contacts/segments/lib/segments";

/**
 * ENG-6956 against real Postgres: a survey's private targeting segment is stored under the survey's id,
 * and `createSegment` upserts private segments by title. The unit suites mock Prisma, so only a real
 * database shows that the upsert's update branch can no longer reach a segment that belongs to another
 * survey, or a shared segment that holds the title.
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

let workspaceId: string;
let victimSurveyId: string;
let attackerSurveyId: string;

const filtersOf = async (title: string) =>
  (await prisma.segment.findUnique({ where: { workspaceId_title: { workspaceId, title } } }))?.filters;

const segmentOf = (title: string) =>
  prisma.segment.findUnique({
    where: { workspaceId_title: { workspaceId, title } },
    include: { surveys: { select: { id: true } } },
  });

const VICTIM_FILTERS = attributeFilters("victim@example.com");

beforeEach(async () => {
  await resetDb();
  const organization = await prisma.organization.create({ data: { name: "ENG-6956 Org" } });
  workspaceId = (
    await prisma.workspace.create({ data: { name: "ENG-6956 Workspace", organizationId: organization.id } })
  ).id;

  const createSurvey = async (name: string) =>
    (
      await prisma.survey.create({
        data: { name, type: "app", status: "inProgress", workspaceId },
        select: { id: true },
      })
    ).id;
  victimSurveyId = await createSurvey("Victim");
  attackerSurveyId = await createSurvey("Attacker");

  // The victim's private targeting segment, as the survey save leaves it.
  await prisma.segment.create({
    data: {
      title: victimSurveyId,
      isPrivate: true,
      filters: VICTIM_FILTERS,
      workspaceId,
      surveys: { connect: { id: victimSurveyId } },
    },
  });
});

describe("createSegment private segments (ENG-6956)", () => {
  test("a private segment titled with another survey's id is refused and the victim's segment is untouched", async () => {
    await expect(
      createSegment({
        workspaceId,
        title: victimSurveyId,
        isPrivate: true,
        surveyId: attackerSurveyId,
        filters: attributeFilters("attacker@example.com"),
      })
    ).rejects.toBeInstanceOf(ValidationError);

    expect(await filtersOf(victimSurveyId)).toEqual(VICTIM_FILTERS);
    const victim = await segmentOf(victimSurveyId);
    expect(victim?.surveys.map((survey) => survey.id)).toEqual([victimSurveyId]);
    expect(
      (await prisma.survey.findUnique({ where: { id: attackerSurveyId }, select: { segmentId: true } }))
        ?.segmentId
    ).toBeNull();
  });

  test("a survey still creates, then saves again, its own private segment", async () => {
    const first = await createSegment({
      workspaceId,
      title: attackerSurveyId,
      isPrivate: true,
      surveyId: attackerSurveyId,
      filters: attributeFilters("one@example.com"),
    });
    // Auto-save made the segment before publish, so the second write has to update it.
    const second = await createSegment({
      workspaceId,
      title: attackerSurveyId,
      isPrivate: true,
      surveyId: attackerSurveyId,
      filters: attributeFilters("two@example.com"),
    });

    expect(second.id).toBe(first.id);
    expect(await filtersOf(attackerSurveyId)).toEqual([
      expect.objectContaining({ resource: expect.objectContaining({ value: "two@example.com" }) }),
    ]);
    expect(await filtersOf(victimSurveyId)).toEqual(VICTIM_FILTERS);
  });

  test("the upsert does not rewrite a shared segment that already holds the survey's title", async () => {
    // Created before the guard existed (or by hand): a shared segment titled with the attacker's survey id.
    const shared = await prisma.segment.create({
      data: {
        title: attackerSurveyId,
        isPrivate: false,
        filters: attributeFilters("shared@example.com"),
        workspaceId,
      },
    });

    await expect(
      createSegment({
        workspaceId,
        title: attackerSurveyId,
        isPrivate: true,
        surveyId: attackerSurveyId,
        filters: attributeFilters("overwrite@example.com"),
      })
    ).rejects.toBeInstanceOf(DatabaseError);

    const after = await prisma.segment.findUniqueOrThrow({ where: { id: shared.id } });
    expect(after.isPrivate).toBe(false);
    expect(after.filters).toEqual(shared.filters);
  });
});

describe("shared segment titles (ENG-6956)", () => {
  test("a shared segment cannot be created with a survey's id as its title", async () => {
    await expect(
      createSegment({
        workspaceId,
        title: victimSurveyId,
        isPrivate: false,
        surveyId: attackerSurveyId,
        filters: attributeFilters("squat@example.com"),
      })
    ).rejects.toBeInstanceOf(InvalidInputError);

    expect(await filtersOf(victimSurveyId)).toEqual(VICTIM_FILTERS);
  });

  test("a shared segment can still be created with an ordinary title", async () => {
    const segment = await createSegment({
      workspaceId,
      title: "Power users",
      isPrivate: false,
      surveyId: attackerSurveyId,
      filters: attributeFilters("power@example.com"),
    });

    expect(segment.title).toBe("Power users");
    expect(segment.isPrivate).toBe(false);
  });

  test("a shared segment cannot be renamed to a survey's id, but can be renamed otherwise", async () => {
    const shared = await createSegment({
      workspaceId,
      title: "Power users",
      isPrivate: false,
      surveyId: attackerSurveyId,
      filters: attributeFilters("power@example.com"),
    });

    await expect(updateSegment(shared.id, { title: victimSurveyId })).rejects.toBeInstanceOf(
      InvalidInputError
    );
    expect((await prisma.segment.findUniqueOrThrow({ where: { id: shared.id } })).title).toBe("Power users");

    const renamed = await updateSegment(shared.id, { title: "Loyal users" });
    expect(renamed.title).toBe("Loyal users");
  });

  test("updating a private segment keeps its own title, which is its survey's id", async () => {
    const victim = await segmentOf(victimSurveyId);

    const updated = await updateSegment(victim!.id, {
      title: victimSurveyId,
      filters: attributeFilters("new@example.com"),
    });

    expect(updated.title).toBe(victimSurveyId);
  });
});
