import { createId } from "@paralleldrive/cuid2";
import { beforeEach, describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";
import { InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";
import type { TBaseFilters } from "@formbricks/types/segment";
import type { TSurvey } from "@formbricks/types/surveys/types";
import {
  createWorkspaceOnContactDirectory,
  createWorkspaceWithContactDirectory,
} from "@/integration/contact-directory-fixture";
import { resetDb } from "@/integration/reset-db";
import { selectSurvey, updateSurveyInternal } from "@/lib/survey/service";
import { transformPrismaSurvey } from "@/lib/survey/utils";
import { segmentFilterToPrismaQuery } from "@/modules/ee/contacts/segments/lib/filter/prisma-query";
import {
  ALL_SEGMENT_SURVEY_REFS,
  createSegment,
  getSegmentInWorkspace,
  getSegments,
  resetSegmentInSurvey,
} from "@/modules/ee/contacts/segments/lib/segments";

/**
 * Decision 24 against real Postgres: segments belong to the contact directory. Workspaces A and B share
 * directory D; workspace C is on a directory of its own in the same organization. The unit suites mock
 * Prisma, so only a real database shows the title rule (the `(directoryId, title)` index), the raw SQL
 * of number filters, and what deleting one workspace of a shared directory leaves behind.
 */

const ageOver = (value: number): TBaseFilters => [
  {
    id: createId(),
    connector: null,
    resource: {
      id: createId(),
      root: { type: "attribute", contactAttributeKey: "age" },
      value,
      qualifier: { operator: "greaterThan" },
    },
  },
];

let workspaceA: string;
let workspaceB: string;
let workspaceC: string;
let directoryD: string;
let directoryC: string;

const publicSegmentIn = (workspaceId: string, title: string) =>
  createSegment({ workspaceId, title, isPrivate: false, filters: ageOver(30), surveyId: "" });

/**
 * A contact with an `age` attribute as a 6.2 pod left it: the number only in `value`, `valueNumber`
 * empty, so evaluation takes the raw SQL fallback.
 */
const contactAged = async (workspaceId: string, directoryId: string, ageKeyId: string, age: string) => {
  const contact = await prisma.contact.create({ data: { workspaceId, directoryId }, select: { id: true } });
  await prisma.contactAttribute.create({
    data: { contactId: contact.id, attributeKeyId: ageKeyId, value: age, valueNumber: null },
  });
  return contact.id;
};

beforeEach(async () => {
  await resetDb();
  const organization = await prisma.organization.create({ data: { name: "ENG-7496 Org" } });
  ({ workspaceId: workspaceA, directoryId: directoryD } = await createWorkspaceWithContactDirectory(
    organization.id,
    "A"
  ));
  workspaceB = await createWorkspaceOnContactDirectory(organization.id, directoryD, "B");
  ({ workspaceId: workspaceC, directoryId: directoryC } = await createWorkspaceWithContactDirectory(
    organization.id,
    "C"
  ));
});

describe("public segments of a shared directory", () => {
  test("a segment made in one workspace is listed and usable in every workspace of the directory", async () => {
    const segment = await publicSegmentIn(workspaceA, "Adults");

    const listedInB = await getSegments(workspaceB, ALL_SEGMENT_SURVEY_REFS);
    expect(listedInB.map(({ id }) => id)).toEqual([segment.id]);
    await expect(getSegmentInWorkspace(segment.id, workspaceB)).resolves.toMatchObject({
      workspaceId: workspaceA,
      directoryId: directoryD,
    });

    await expect(getSegments(workspaceC, ALL_SEGMENT_SURVEY_REFS)).resolves.toEqual([]);
    await expect(getSegmentInWorkspace(segment.id, workspaceC)).rejects.toBeInstanceOf(ResourceNotFoundError);
  });

  test("titles are unique per directory, not per workspace", async () => {
    await publicSegmentIn(workspaceA, "Adults");

    await expect(publicSegmentIn(workspaceB, "Adults")).rejects.toBeInstanceOf(InvalidInputError);
    await expect(publicSegmentIn(workspaceC, "Adults")).resolves.toMatchObject({ title: "Adults" });
  });

  test("private segments are never listed in another workspace, and save by directory and title", async () => {
    const surveyInA = await prisma.survey.create({
      data: { name: "App survey", type: "app", status: "inProgress", workspaceId: workspaceA },
      select: { id: true },
    });
    const privateSegment = await createSegment({
      workspaceId: workspaceA,
      title: surveyInA.id,
      isPrivate: true,
      surveyId: surveyInA.id,
      filters: ageOver(30),
    });

    // A second save of the survey's targeting updates the same row, found by (directory, title).
    const newerFilters = ageOver(40);
    const saved = await createSegment({
      workspaceId: workspaceA,
      title: surveyInA.id,
      isPrivate: true,
      surveyId: surveyInA.id,
      filters: newerFilters,
    });
    expect(saved.id).toBe(privateSegment.id);
    await expect(
      prisma.segment.findUniqueOrThrow({
        where: { directoryId_title: { directoryId: directoryD, title: surveyInA.id } },
        select: { id: true, filters: true },
      })
    ).resolves.toEqual({ id: privateSegment.id, filters: newerFilters });

    expect((await getSegments(workspaceB, ALL_SEGMENT_SURVEY_REFS)).map(({ id }) => id)).not.toContain(
      privateSegment.id
    );
    expect((await getSegments(workspaceA, ALL_SEGMENT_SURVEY_REFS)).map(({ id }) => id)).toContain(
      privateSegment.id
    );
  });
});

describe("evaluation reads contacts and keys by directory", () => {
  test("the raw SQL of a number filter matches the directory's contacts, whichever workspace made the key", async () => {
    // The key was made from workspace A; the contacts come from both workspaces of the directory.
    const ageKeyD = await prisma.contactAttributeKey.create({
      data: { key: "age", dataType: "number", workspaceId: workspaceA, directoryId: directoryD },
      select: { id: true },
    });
    const ageKeyC = await prisma.contactAttributeKey.create({
      data: { key: "age", dataType: "number", workspaceId: workspaceC, directoryId: directoryC },
      select: { id: true },
    });
    const olderInB = await contactAged(workspaceB, directoryD, ageKeyD.id, "42");
    const olderInA = await contactAged(workspaceA, directoryD, ageKeyD.id, "51");
    await contactAged(workspaceB, directoryD, ageKeyD.id, "12");
    await contactAged(workspaceC, directoryC, ageKeyC.id, "60");

    const query = await segmentFilterToPrismaQuery(createId(), ageOver(30), directoryD, workspaceB);
    if (!query.ok) throw new Error("the filter did not build");
    const matched = await prisma.contact.findMany({ where: query.data.whereClause, select: { id: true } });

    expect(matched.map(({ id }) => id).sort()).toEqual([olderInA, olderInB].sort());
  });
});

describe("deleting one workspace of a shared directory", () => {
  test("keeps the segments the other workspaces' surveys use", async () => {
    const segment = await publicSegmentIn(workspaceA, "Adults");
    const surveyInB = await prisma.survey.create({
      data: {
        name: "App survey",
        type: "app",
        status: "inProgress",
        workspaceId: workspaceB,
        segmentId: segment.id,
      },
      select: { id: true },
    });

    await prisma.workspace.delete({ where: { id: workspaceA } });

    await expect(
      prisma.segment.findUnique({
        where: { id: segment.id },
        select: { workspaceId: true, directoryId: true },
      })
    ).resolves.toEqual({ workspaceId: null, directoryId: directoryD });
    await expect(
      prisma.survey.findUnique({ where: { id: surveyInB.id }, select: { segmentId: true } })
    ).resolves.toEqual({ segmentId: segment.id });
    // A segment with no origin workspace still lists in B.
    expect((await getSegments(workspaceB, ALL_SEGMENT_SURVEY_REFS)).map(({ id }) => id)).toEqual([
      segment.id,
    ]);
  });
});

// Decision 3: a new workspace starts with no contact directory, and its app surveys still get a private
// segment, kept by workspace until a directory is picked.
describe("a workspace with no contact directory", () => {
  test("its app surveys keep a private segment, found by workspace and title", async () => {
    const organization = await prisma.organization.create({ data: { name: "No directory Org" } });
    const bareWorkspace = (
      await prisma.workspace.create({ data: { name: "Bare", organizationId: organization.id } })
    ).id;
    const survey = await prisma.survey.create({
      data: { name: "App survey", type: "app", status: "draft", workspaceId: bareWorkspace },
      select: { id: true },
    });
    const load = async () =>
      transformPrismaSurvey<TSurvey>(
        await prisma.survey.findUniqueOrThrow({ where: { id: survey.id }, select: selectSurvey })
      );

    // The draft autosave of an app survey with no segment makes its private one.
    await updateSurveyInternal({ ...(await load()), segment: null }, true);
    const created = await prisma.segment.findUniqueOrThrow({
      where: { workspaceId_title: { workspaceId: bareWorkspace, title: survey.id } },
      select: { id: true, directoryId: true, isPrivate: true },
    });
    expect(created).toMatchObject({ directoryId: null, isPrivate: true });

    // "Reset all filters" and a private save find that same segment.
    await expect(resetSegmentInSurvey(survey.id)).resolves.toMatchObject({ id: created.id });
    await expect(
      createSegment({
        workspaceId: bareWorkspace,
        title: survey.id,
        isPrivate: true,
        surveyId: survey.id,
        filters: ageOver(30),
      })
    ).resolves.toMatchObject({ id: created.id });

    // A shared segment needs a directory.
    await expect(publicSegmentIn(bareWorkspace, "Adults")).rejects.toThrow();
  });
});

describe("private segments on a shared directory", () => {
  const privateSegmentIn = (workspaceId: string, directoryId: string, filters: TBaseFilters) =>
    prisma.segment.create({
      data: { workspaceId, directoryId, title: createId(), isPrivate: true, filters },
      select: { id: true },
    });

  test("another workspace of the directory cannot reach one by id", async () => {
    const segment = await privateSegmentIn(workspaceA, directoryD, ageOver(30));

    await expect(getSegmentInWorkspace(segment.id, workspaceA)).resolves.toMatchObject({ id: segment.id });
    await expect(getSegmentInWorkspace(segment.id, workspaceB)).rejects.toBeInstanceOf(ResourceNotFoundError);
  });

  test("another workspace of the directory cannot nest one as a filter", async () => {
    const ageKeyD = await prisma.contactAttributeKey.create({
      data: { key: "age", workspaceId: workspaceA, directoryId: directoryD, dataType: "number" },
    });
    const older = await contactAged(workspaceA, directoryD, ageKeyD.id, "51");
    const younger = await contactAged(workspaceA, directoryD, ageKeyD.id, "12");
    const secret = await privateSegmentIn(workspaceA, directoryD, ageOver(30));
    const nesting: TBaseFilters = [
      {
        id: createId(),
        connector: null,
        resource: {
          id: createId(),
          root: { type: "segment", segmentId: secret.id },
          value: "",
          qualifier: { operator: "userIsIn" },
        },
      },
    ];
    const members = async (workspaceId: string) => {
      const query = await segmentFilterToPrismaQuery(createId(), nesting, directoryD, workspaceId);
      if (!query.ok) throw new Error("the filter did not build");
      const rows = await prisma.contact.findMany({ where: query.data.whereClause, select: { id: true } });
      return rows.map(({ id }) => id).sort();
    };

    expect(await members(workspaceA)).toEqual([older]);
    // From B the private segment's filters are not applied: membership tells nothing about them.
    expect(await members(workspaceB)).toEqual([older, younger].sort());
  });
});
