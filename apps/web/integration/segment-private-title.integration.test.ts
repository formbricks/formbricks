import { createId } from "@paralleldrive/cuid2";
import { beforeEach, describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";
import { InvalidInputError, ValidationError } from "@formbricks/types/errors";
import type { TBaseFilters, TSegmentCreateInput } from "@formbricks/types/segment";
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

const privateInput = (title: string, surveyId: string, email: string): TSegmentCreateInput => ({
  workspaceId,
  title,
  isPrivate: true,
  surveyId,
  filters: attributeFilters(email),
});

const sharedInput = (title: string, surveyId: string, email: string): TSegmentCreateInput => ({
  ...privateInput(title, surveyId, email),
  isPrivate: false,
});

const segmentOf = (title: string) =>
  prisma.segment.findUniqueOrThrow({
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
      createSegment(privateInput(victimSurveyId, attackerSurveyId, "attacker@example.com"))
    ).rejects.toBeInstanceOf(ValidationError);

    const victim = await segmentOf(victimSurveyId);
    expect(victim.filters).toEqual(VICTIM_FILTERS);
    expect(victim.surveys.map((survey) => survey.id)).toEqual([victimSurveyId]);
    expect(
      (
        await prisma.survey.findUniqueOrThrow({
          where: { id: attackerSurveyId },
          select: { segmentId: true },
        })
      ).segmentId
    ).toBeNull();
  });

  test("a survey still creates, then saves again, its own private segment", async () => {
    const first = await createSegment(privateInput(attackerSurveyId, attackerSurveyId, "one@example.com"));
    // Auto-save made the segment before publish, so the second write has to update it.
    const second = await createSegment(privateInput(attackerSurveyId, attackerSurveyId, "two@example.com"));

    expect(second.id).toBe(first.id);
    expect((await segmentOf(attackerSurveyId)).filters).toEqual([
      expect.objectContaining({ resource: expect.objectContaining({ value: "two@example.com" }) }),
    ]);
    expect((await segmentOf(victimSurveyId)).filters).toEqual(VICTIM_FILTERS);
  });

  test("a survey's save takes over its own private segment when no survey is linked to it", async () => {
    const orphan = await prisma.segment.create({
      data: { title: attackerSurveyId, isPrivate: true, filters: [], workspaceId },
    });

    const saved = await createSegment(privateInput(attackerSurveyId, attackerSurveyId, "own@example.com"));

    expect(saved.id).toBe(orphan.id);
    expect(saved.surveys).toEqual([attackerSurveyId]);
  });

  test("a survey's save does not rewrite a private segment another survey also uses", async () => {
    // Left by older bugs: the victim's targeting also sits on the segment titled with the attacker's id.
    await prisma.segment.create({
      data: {
        title: attackerSurveyId,
        isPrivate: true,
        filters: VICTIM_FILTERS,
        workspaceId,
        surveys: { connect: [{ id: attackerSurveyId }, { id: victimSurveyId }] },
      },
    });

    await expect(
      createSegment(privateInput(attackerSurveyId, attackerSurveyId, "attacker@example.com"))
    ).rejects.toThrow(new InvalidInputError("A segment with this title already exists"));

    const shared = await segmentOf(attackerSurveyId);
    expect(shared.filters).toEqual(VICTIM_FILTERS);
    expect(shared.surveys.map((survey) => survey.id).sort()).toEqual(
      [attackerSurveyId, victimSurveyId].sort()
    );
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
      createSegment(privateInput(attackerSurveyId, attackerSurveyId, "overwrite@example.com"))
    ).rejects.toThrow(new InvalidInputError("A segment with this title already exists"));

    const after = await prisma.segment.findUniqueOrThrow({ where: { id: shared.id } });
    expect(after.isPrivate).toBe(false);
    expect(after.filters).toEqual(shared.filters);
  });
});

describe("shared segment titles (ENG-6956)", () => {
  test("a shared segment cannot be created with a survey's id as its title", async () => {
    // The attacker's survey has no segment yet, so only the survey-id guard can refuse this title.
    await expect(createSegment(sharedInput(attackerSurveyId, "", "squat@example.com"))).rejects.toThrow(
      new InvalidInputError("A segment cannot be titled with the id of a survey")
    );

    expect(await prisma.segment.count({ where: { workspaceId, title: attackerSurveyId } })).toBe(0);
  });

  test("a shared segment can still be created with an ordinary title, from the segments page or a survey", async () => {
    // The segments page sends no survey; Save as new segment in the survey editor sends its survey.
    const fromSegmentsPage = await createSegment(sharedInput("Power users", "", "power@example.com"));
    const fromSurvey = await createSegment(sharedInput("Loyal users", attackerSurveyId, "loyal@example.com"));

    expect(fromSegmentsPage).toMatchObject({ title: "Power users", isPrivate: false, surveys: [] });
    expect(fromSurvey).toMatchObject({ title: "Loyal users", isPrivate: false, surveys: [attackerSurveyId] });
  });

  test("a shared segment cannot be renamed to a survey's id, but can be renamed otherwise", async () => {
    const shared = await createSegment(sharedInput("Power users", "", "power@example.com"));

    // The attacker's survey has no segment yet, so only the survey-id guard can refuse this title.
    await expect(updateSegment(shared.id, { title: attackerSurveyId })).rejects.toThrow(
      new InvalidInputError("A segment cannot be titled with the id of a survey")
    );
    expect((await prisma.segment.findUniqueOrThrow({ where: { id: shared.id } })).title).toBe("Power users");

    const renamed = await updateSegment(shared.id, { title: "Loyal users", isPrivate: false });
    expect(renamed.title).toBe("Loyal users");
  });

  test("updating a private segment keeps its own title, which is its survey's id", async () => {
    const victim = await segmentOf(victimSurveyId);

    const filters = attributeFilters("new@example.com");
    const updated = await updateSegment(victim.id, { title: victimSurveyId, filters });

    expect(updated.title).toBe(victimSurveyId);
    expect((await segmentOf(victimSurveyId)).filters).toEqual(filters);
  });

  test("a private segment keeps its survey's id as title until it turns shared", async () => {
    const victim = await segmentOf(victimSurveyId);

    await expect(updateSegment(victim.id, { title: "Renamed" })).rejects.toThrow(
      new InvalidInputError("A private segment keeps the id of its survey as title")
    );
    expect((await segmentOf(victimSurveyId)).id).toBe(victim.id);

    // Save as new segment in the survey editor turns the survey's private segment into a named shared one.
    const shared = await updateSegment(victim.id, { title: "Loyal users", isPrivate: false });
    expect(shared).toMatchObject({ id: victim.id, title: "Loyal users", isPrivate: false });
  });

  test("a private segment cannot turn shared while it keeps its survey's id as title", async () => {
    const victim = await segmentOf(victimSurveyId);

    await expect(updateSegment(victim.id, { isPrivate: false })).rejects.toThrow(
      new InvalidInputError("A segment cannot be titled with the id of a survey")
    );
    expect((await segmentOf(victimSurveyId)).isPrivate).toBe(true);
  });
});
