import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { createWorkspaceWithContactDirectory } from "@/integration/contact-directory-fixture";
import { resetDb } from "@/integration/reset-db";
import { selectSurvey, updateSurvey } from "@/lib/survey/service";
import { transformPrismaSurvey } from "@/lib/survey/utils";

/**
 * Decisions 1 and 4 against real Postgres: a workspace that leaves its contact directory, or joins another,
 * keeps its surveys' segment links, so an app survey can be stored on the old directory's segment. Its save
 * (the editor's Save, the status dropdown) sends that segment back and must still go through, without
 * writing to that segment. A segment of another directory the survey is not on stays refused.
 */

vi.mock("@/modules/ee/license-check/lib/utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/ee/license-check/lib/utils")>()),
  getIsContactsEnabled: async () => true,
}));

const BLOCKS = [
  {
    id: "clbk1234567890123456780001",
    name: "Main Block",
    elements: [
      {
        id: "satisfaction",
        type: "openText",
        headline: { default: "What should we improve?" },
        required: true,
        inputType: "text",
        charLimit: { enabled: false },
      },
    ],
  },
];

const EMAIL_FILTER = [
  {
    id: "clfilter00000000000000001",
    connector: null,
    resource: {
      id: "clresrc000000000000000001",
      root: { type: "attribute", contactAttributeKey: "email" },
      qualifier: { operator: "equals" },
      value: "someone@example.com",
    },
  },
];

const seed = async () => {
  const organization = await prisma.organization.create({ data: { name: "Other directory segment" } });
  const { workspaceId, directoryId: oldDirectoryId } = await createWorkspaceWithContactDirectory(
    organization.id,
    "Leaving"
  );
  const { directoryId: newDirectoryId } = await createWorkspaceWithContactDirectory(organization.id, "New");

  // A live app survey needs a trigger to be saved with a non-draft status.
  const actionClass = await prisma.actionClass.create({
    data: { name: "Opened", type: "code", key: "opened", workspaceId },
    select: { id: true },
  });
  const surveyId = (
    await prisma.survey.create({
      data: {
        name: "App survey",
        type: "app",
        status: "inProgress",
        workspaceId,
        blocks: BLOCKS as never,
        triggers: { create: { actionClassId: actionClass.id } },
      },
      select: { id: true },
    })
  ).id;
  const privateSegmentId = (
    await prisma.segment.create({
      data: {
        title: surveyId,
        isPrivate: true,
        filters: EMAIL_FILTER,
        workspaceId,
        directoryId: oldDirectoryId,
        surveys: { connect: { id: surveyId } },
      },
      select: { id: true },
    })
  ).id;
  const oldSharedSegmentId = (
    await prisma.segment.create({
      data: { title: "Old shared", isPrivate: false, filters: [], workspaceId, directoryId: oldDirectoryId },
      select: { id: true },
    })
  ).id;

  return { workspaceId, newDirectoryId, surveyId, privateSegmentId, oldSharedSegmentId };
};

const loadSurvey = async (surveyId: string): Promise<TSurvey> =>
  prisma.survey
    .findUniqueOrThrow({ where: { id: surveyId }, select: selectSurvey })
    .then((survey) => transformPrismaSurvey<TSurvey>(survey));

const readSegment = (id: string) =>
  prisma.segment.findUniqueOrThrow({
    where: { id },
    select: { title: true, filters: true, isPrivate: true, directoryId: true, updatedAt: true },
  });

const readSurvey = (id: string) =>
  prisma.survey.findUniqueOrThrow({ where: { id }, select: { name: true, status: true, segmentId: true } });

describe("an app survey stored on another contact directory's segment", () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe.each([
    ["joined another directory", "new"],
    ["was removed from its directory", "none"],
  ] as const)("after its workspace %s", (_label, move) => {
    let ids: Awaited<ReturnType<typeof seed>>;

    beforeEach(async () => {
      ids = await seed();
      await prisma.workspace.update({
        where: { id: ids.workspaceId },
        data: { contactDirectoryId: move === "new" ? ids.newDirectoryId : null },
      });
    });

    test("saves a status change and an unrelated edit, leaving the segment as it is", async () => {
      const segmentBefore = await readSegment(ids.privateSegmentId);
      const survey = await loadSurvey(ids.surveyId);

      await updateSurvey({ ...survey, name: "Renamed", status: "paused" });

      expect(await readSurvey(ids.surveyId)).toEqual({
        name: "Renamed",
        status: "paused",
        segmentId: ids.privateSegmentId,
      });
      expect(await readSegment(ids.privateSegmentId)).toEqual(segmentBefore);
    });

    test("writes no filter edit sent with that segment", async () => {
      const segmentBefore = await readSegment(ids.privateSegmentId);
      const survey = await loadSurvey(ids.surveyId);

      await updateSurvey({ ...survey, segment: { ...survey.segment!, filters: [] } });

      expect(await readSegment(ids.privateSegmentId)).toEqual(segmentBefore);
      expect((await readSurvey(ids.surveyId)).segmentId).toBe(ids.privateSegmentId);
    });

    test("refuses switching to another segment of the old directory", async () => {
      const survey = await loadSurvey(ids.surveyId);
      const oldShared = await prisma.segment.findUniqueOrThrow({ where: { id: ids.oldSharedSegmentId } });

      await expect(
        updateSurvey({
          ...survey,
          segment: {
            ...oldShared,
            description: oldShared.description ?? "",
            filters: [],
            surveys: [ids.surveyId],
          },
        })
      ).rejects.toMatchObject({ name: "ResourceNotFoundError" });

      expect((await readSurvey(ids.surveyId)).segmentId).toBe(ids.privateSegmentId);
    });
  });

  test("links a segment of the workspace's new directory", async () => {
    const ids = await seed();
    await prisma.workspace.update({
      where: { id: ids.workspaceId },
      data: { contactDirectoryId: ids.newDirectoryId },
    });
    const newShared = await prisma.segment.create({
      data: {
        title: "New shared",
        isPrivate: false,
        filters: [],
        workspaceId: ids.workspaceId,
        directoryId: ids.newDirectoryId,
      },
    });
    const survey = await loadSurvey(ids.surveyId);

    await updateSurvey({
      ...survey,
      segment: { ...newShared, description: "", filters: [], surveys: [ids.surveyId] },
    });

    expect((await readSurvey(ids.surveyId)).segmentId).toBe(newShared.id);
  });
});
