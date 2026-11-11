import { beforeEach, describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { resetDb } from "@/integration/reset-db";
import { selectSurvey, updateSurvey, updateSurveyInternal } from "@/lib/survey/service";
import { transformPrismaSurvey } from "@/lib/survey/utils";
import type { TSurveyActorContext } from "@/lib/survey/visibility/actor-context";

/**
 * ENG-6957 against real Postgres: a survey save changes the saved survey's targeting only.
 *
 * The editor save, its autosave and the v1 management PUT all reach `updateSurveyInternal` with the
 * survey's `segment` as the client sent it. Trusting it let a member who may write their own survey
 * change another survey's targeting, a Restricted one included: connect it to their segment
 * (`segment.surveys`), overwrite the filters of a segment it uses (`segment.id`), or delete its private
 * segment (a save that leaves app targeting). The unit suite mocks Prisma, so only a real database shows
 * which rows the save actually moved.
 *
 * Fixture: W is the member's own app survey, R a Restricted app survey owned by the organization owner,
 * each with its own private segment. `shared` is a shared segment.
 */

const BLOCKS = [
  {
    id: "clbk1234567890123456786957",
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
    id: "clfilter00000000000006957",
    connector: null,
    resource: {
      id: "clresrc000000000000006957",
      root: { type: "attribute", contactAttributeKey: "email" },
      qualifier: { operator: "equals" },
      value: "someone@example.com",
    },
  },
];

let workspaceId: string;
let ownerId: string;
let memberId: string;
const ids = { W: "", R: "", segmentW: "", segmentR: "", shared: "" };

const member = (): TSurveyActorContext => ({
  enforced: true,
  isOrganizationAdmin: false,
  kind: "user",
  userId: memberId,
});

const seed = async (): Promise<void> => {
  const organization = await prisma.organization.create({ data: { name: "ENG-6957 Org" } });
  workspaceId = (
    await prisma.workspace.create({ data: { name: "ENG-6957 Workspace", organizationId: organization.id } })
  ).id;
  ownerId = (await prisma.user.create({ data: { name: "Owner", email: "owner@eng6957.test" } })).id;
  memberId = (await prisma.user.create({ data: { name: "Member", email: "member@eng6957.test" } })).id;

  const createAppSurvey = async (name: string, extra: Record<string, unknown> = {}) => {
    const surveyId = (
      await prisma.survey.create({
        data: { name, type: "app", status: "draft", workspaceId, blocks: BLOCKS as never, ...extra },
        select: { id: true },
      })
    ).id;
    const segmentId = (
      await prisma.segment.create({
        data: {
          title: surveyId,
          isPrivate: true,
          filters: [],
          workspaceId,
          surveys: { connect: { id: surveyId } },
        },
        select: { id: true },
      })
    ).id;
    return { surveyId, segmentId };
  };

  const w = await createAppSurvey("W");
  const r = await createAppSurvey("R", { visibility: "restricted", ownerId });
  ids.W = w.surveyId;
  ids.segmentW = w.segmentId;
  ids.R = r.surveyId;
  ids.segmentR = r.segmentId;
  ids.shared = (
    await prisma.segment.create({
      data: { title: "Shared", isPrivate: false, filters: [], workspaceId },
      select: { id: true },
    })
  ).id;
};

const loadSurvey = async (surveyId: string): Promise<TSurvey> =>
  prisma.survey
    .findUniqueOrThrow({ where: { id: surveyId }, select: selectSurvey })
    .then((survey) => transformPrismaSurvey<TSurvey>(survey));

const segmentIdOf = async (surveyId: string) =>
  (await prisma.survey.findUniqueOrThrow({ where: { id: surveyId }, select: { segmentId: true } })).segmentId;

describe("a survey save changes only its own survey's targeting (ENG-6957)", () => {
  beforeEach(async () => {
    await resetDb();
    await seed();
  });

  test("another survey's id in segment.surveys does not re-point that survey (editor save)", async () => {
    const w = await loadSurvey(ids.W);

    await updateSurvey(
      { ...w, segment: { ...w.segment!, surveys: [ids.W, ids.R] } },
      { targetingActor: member() }
    );

    expect(await segmentIdOf(ids.R)).toBe(ids.segmentR);
    expect(await segmentIdOf(ids.W)).toBe(ids.segmentW);
  });

  test("another survey's id in segment.surveys does not re-point that survey (draft autosave)", async () => {
    const w = await loadSurvey(ids.W);

    await updateSurveyInternal({ ...w, segment: { ...w.segment!, surveys: [ids.R] } }, true, {
      targetingActor: member(),
    });

    expect(await segmentIdOf(ids.R)).toBe(ids.segmentR);
    expect(await segmentIdOf(ids.W)).toBe(ids.segmentW);
  });

  test("the save still writes the survey's own private segment", async () => {
    const w = await loadSurvey(ids.W);

    await updateSurvey(
      { ...w, segment: { ...w.segment!, filters: EMAIL_FILTER } as never },
      { targetingActor: member() }
    );

    expect(await segmentIdOf(ids.W)).toBe(ids.segmentW);
    const stored = await prisma.segment.findUniqueOrThrow({ where: { id: ids.segmentW } });
    expect(stored.filters).toEqual(EMAIL_FILTER);
  });

  test("a save that names its own survey still links it to another segment", async () => {
    const w = await loadSurvey(ids.W);
    const shared = await prisma.segment.findUniqueOrThrow({ where: { id: ids.shared } });

    await updateSurvey(
      {
        ...w,
        segment: {
          ...shared,
          description: shared.description ?? "",
          filters: [],
          surveys: [ids.W, ids.R],
        },
      },
      { targetingActor: member() }
    );

    expect(await segmentIdOf(ids.W)).toBe(ids.shared);
    expect(await segmentIdOf(ids.R)).toBe(ids.segmentR);
  });

  test("naming another survey's private segment does not write it", async () => {
    const w = await loadSurvey(ids.W);
    const segmentR = await prisma.segment.findUniqueOrThrow({ where: { id: ids.segmentR } });

    await updateSurvey(
      { ...w, segment: { ...segmentR, description: "", filters: EMAIL_FILTER, surveys: [] } as never },
      { targetingActor: member() }
    );

    expect((await prisma.segment.findUniqueOrThrow({ where: { id: ids.segmentR } })).filters).toEqual([]);
    expect(await segmentIdOf(ids.R)).toBe(ids.segmentR);
    expect(await segmentIdOf(ids.W)).toBe(ids.segmentW);
  });

  test("a survey cannot link itself to another survey's private segment", async () => {
    const w = await loadSurvey(ids.W);
    const segmentR = await prisma.segment.findUniqueOrThrow({ where: { id: ids.segmentR } });

    await expect(
      updateSurvey(
        { ...w, segment: { ...segmentR, description: "", filters: EMAIL_FILTER, surveys: [ids.W] } as never },
        { targetingActor: member() }
      )
    ).rejects.toMatchObject({ name: "InvalidInputError" });

    expect((await prisma.segment.findUniqueOrThrow({ where: { id: ids.segmentR } })).filters).toEqual([]);
    expect(await segmentIdOf(ids.W)).toBe(ids.segmentW);
  });

  test("leaving app targeting deletes the survey's own private segment, not the one the client names", async () => {
    const w = await loadSurvey(ids.W);
    const segmentR = await prisma.segment.findUniqueOrThrow({ where: { id: ids.segmentR } });

    await updateSurvey(
      { ...w, type: "link", segment: { ...segmentR, description: "", surveys: [] } as never },
      { targetingActor: member() }
    );

    expect(await segmentIdOf(ids.R)).toBe(ids.segmentR);
    expect(await segmentIdOf(ids.W)).toBeNull();
    expect(await prisma.segment.findUnique({ where: { id: ids.segmentW } })).toBeNull();
  });

  test("leaving app targeting keeps a shared segment for the surveys still on it", async () => {
    await prisma.survey.updateMany({
      where: { id: { in: [ids.W, ids.R] } },
      data: { segmentId: ids.shared },
    });
    const w = await loadSurvey(ids.W);

    await updateSurvey({ ...w, type: "link" }, { targetingActor: member() });

    expect(await segmentIdOf(ids.W)).toBeNull();
    expect(await segmentIdOf(ids.R)).toBe(ids.shared);
  });

  test("a save does not write the filters of a shared segment other surveys use", async () => {
    await prisma.survey.updateMany({
      where: { id: { in: [ids.W, ids.R] } },
      data: { segmentId: ids.shared },
    });
    const w = await loadSurvey(ids.W);

    await updateSurvey(
      { ...w, segment: { ...w.segment!, filters: EMAIL_FILTER } as never },
      { targetingActor: member() }
    );

    expect((await prisma.segment.findUniqueOrThrow({ where: { id: ids.shared } })).filters).toEqual([]);
    expect(await segmentIdOf(ids.R)).toBe(ids.shared);
  });

  test("surveys already on the segment stay on it", async () => {
    await prisma.survey.update({ where: { id: ids.R }, data: { segmentId: ids.shared } });
    await prisma.survey.update({ where: { id: ids.W }, data: { segmentId: ids.shared } });
    const w = await loadSurvey(ids.W);
    expect(w.segment?.surveys.sort()).toEqual([ids.W, ids.R].sort());

    await updateSurvey(w, { targetingActor: member() });

    expect(await segmentIdOf(ids.W)).toBe(ids.shared);
    expect(await segmentIdOf(ids.R)).toBe(ids.shared);
  });
});
