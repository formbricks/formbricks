import { beforeEach, describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { resetDb } from "@/integration/reset-db";
import { selectSurvey, updateSurvey, updateSurveyInternal } from "@/lib/survey/service";
import { transformPrismaSurvey } from "@/lib/survey/utils";
import { updateSurveyDraft } from "@/modules/survey/editor/lib/survey";
import { ZSurveyDraft } from "@/modules/survey/editor/types/survey";

/**
 * ENG-7127 against real Postgres: a survey save writes the survey's own columns and nothing else.
 *
 * The draft save's schema kept unknown keys, and `updateSurveyInternal` spread the rest of the payload
 * into `tx.survey.update`, so Prisma took extra keys as relation writes and foreign keys: a member could
 * make themselves organization owner, rewrite another member's email, or move another organization's
 * response into their survey. The unit suite mocks Prisma, so only a real database shows which rows a
 * save moved.
 *
 * Each payload is sent on its own: Prisma refuses a mix of relation writes and raw foreign keys in one
 * update, so a combined payload would fail for that reason and prove nothing.
 *
 * Fixture: organization A (owner, member) with workspace W, the member's draft link survey D (created
 * and owned by the owner) and segment S; organization B with survey SB and its response RB.
 */

const BLOCKS = [
  {
    id: "clbk1234567890123456787127",
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

const ids = {
  organizationA: "",
  workspaceW: "",
  ownerUser: "",
  memberUser: "",
  draft: "",
  segment: "",
  foreignSurvey: "",
  foreignResponse: "",
};

const seed = async (): Promise<void> => {
  const organizationA = await prisma.organization.create({ data: { name: "ENG-7127 Org A" } });
  const workspaceW = await prisma.workspace.create({
    data: { name: "ENG-7127 Workspace", organizationId: organizationA.id },
  });
  const owner = await prisma.user.create({ data: { name: "Owner", email: "owner@eng7127.test" } });
  const member = await prisma.user.create({ data: { name: "Member", email: "member@eng7127.test" } });
  await prisma.membership.createMany({
    data: [
      { organizationId: organizationA.id, userId: owner.id, role: "owner", accepted: true },
      { organizationId: organizationA.id, userId: member.id, role: "member", accepted: true },
    ],
  });
  const draft = await prisma.survey.create({
    data: {
      name: "Draft",
      type: "link",
      status: "draft",
      workspaceId: workspaceW.id,
      blocks: BLOCKS as never,
      createdBy: owner.id,
      ownerId: owner.id,
    },
    select: { id: true },
  });
  const segment = await prisma.segment.create({
    data: { title: "Shared", isPrivate: false, filters: [], workspaceId: workspaceW.id },
    select: { id: true },
  });

  const organizationB = await prisma.organization.create({ data: { name: "ENG-7127 Org B" } });
  const workspaceB = await prisma.workspace.create({
    data: { name: "ENG-7127 Workspace B", organizationId: organizationB.id },
  });
  const foreignSurvey = await prisma.survey.create({
    data: { name: "Foreign", type: "link", status: "inProgress", workspaceId: workspaceB.id },
    select: { id: true },
  });
  const foreignResponse = await prisma.response.create({
    data: { surveyId: foreignSurvey.id, finished: true, data: { satisfaction: "secret" } },
    select: { id: true },
  });

  Object.assign(ids, {
    organizationA: organizationA.id,
    workspaceW: workspaceW.id,
    ownerUser: owner.id,
    memberUser: member.id,
    draft: draft.id,
    segment: segment.id,
    foreignSurvey: foreignSurvey.id,
    foreignResponse: foreignResponse.id,
  });
};

const loadSurvey = async (surveyId: string): Promise<TSurvey> =>
  prisma.survey
    .findUniqueOrThrow({ where: { id: surveyId }, select: selectSurvey })
    .then((survey) => transformPrismaSurvey<TSurvey>(survey));

/** Every row outside the survey's own columns that one of the payloads below aims at. */
const snapshot = async () => ({
  survey: await prisma.survey.findUniqueOrThrow({
    where: { id: ids.draft },
    select: { segmentId: true, workspaceId: true, createdBy: true, ownerId: true },
  }),
  memberships: await prisma.membership.findMany({
    where: { organizationId: ids.organizationA },
    select: { userId: true, role: true },
    orderBy: { userId: "asc" },
  }),
  users: await prisma.user.findMany({
    where: { id: { in: [ids.ownerUser, ids.memberUser] } },
    select: { id: true, name: true, email: true },
    orderBy: { id: "asc" },
  }),
  workspace: await prisma.workspace.findUniqueOrThrow({
    where: { id: ids.workspaceW },
    select: { name: true, organizationId: true },
  }),
  organizationName: (
    await prisma.organization.findUniqueOrThrow({ where: { id: ids.organizationA }, select: { name: true } })
  ).name,
  foreignResponse: await prisma.response.findUniqueOrThrow({
    where: { id: ids.foreignResponse },
    select: { surveyId: true },
  }),
  draftResponses: await prisma.response.count({ where: { surveyId: ids.draft } }),
});

/**
 * The keys a caller added to an otherwise ordinary save. Each builds its payload when the test runs:
 * `test.each` collects the table before `seed` has set the ids.
 */
const PAYLOADS: [string, () => Record<string, unknown>][] = [
  [
    "responses.connect (another organization's response)",
    () => ({ responses: { connect: [{ id: ids.foreignResponse }] } }),
  ],
  ["segmentId", () => ({ segmentId: ids.segment })],
  [
    "workspace.update reaching the organization's memberships",
    () => ({
      workspace: {
        update: {
          name: "renamed",
          organization: {
            update: {
              name: "renamed",
              memberships: { updateMany: { where: { userId: ids.memberUser }, data: { role: "owner" } } },
            },
          },
        },
      },
    }),
  ],
  ["creator.update", () => ({ creator: { update: { email: "attacker@eng7127.test", name: "renamed" } } })],
  ["owner.update", () => ({ owner: { update: { email: "attacker@eng7127.test", name: "renamed" } } })],
  ["creator.connect", () => ({ creator: { connect: { id: ids.memberUser } } })],
  ["owner.connect", () => ({ owner: { connect: { id: ids.memberUser } } })],
];

describe("a survey save writes only the survey's own columns (ENG-7127)", () => {
  beforeEach(async () => {
    await resetDb();
    await seed();
  });

  test("the fixture is what the payloads aim at", async () => {
    // Guards the assertions below against passing because a target row was never there.
    const before = await snapshot();
    expect(before.memberships.find((m) => m.userId === ids.memberUser)?.role).toBe("member");
    expect(before.survey).toMatchObject({
      segmentId: null,
      createdBy: ids.ownerUser,
      ownerId: ids.ownerUser,
    });
    expect(before.foreignResponse.surveyId).toBe(ids.foreignSurvey);
  });

  test.each(PAYLOADS)(
    "the draft save (ZSurveyDraft, then updateSurveyDraft) drops %s",
    async (_name, buildExtra) => {
      const before = await snapshot();
      const survey = await loadSurvey(ids.draft);

      const parsed = ZSurveyDraft.parse({ ...survey, ...buildExtra(), name: "Saved" });
      await updateSurveyDraft(parsed as TSurvey);

      expect(await snapshot()).toEqual(before);
      expect((await loadSurvey(ids.draft)).name).toBe("Saved");
    }
  );

  // The service's own guard, with the schema out of the way: the v1 PUT, the published save and any
  // future caller reach `updateSurveyInternal` without `ZSurveyDraft`.
  test.each(PAYLOADS)("updateSurveyInternal on its own drops %s (draft path)", async (_name, buildExtra) => {
    const before = await snapshot();
    const survey = await loadSurvey(ids.draft);

    await updateSurveyInternal({ ...survey, ...buildExtra(), name: "Saved" }, true);

    expect(await snapshot()).toEqual(before);
    expect((await loadSurvey(ids.draft)).name).toBe("Saved");
  });

  // `validateInputs` checks the payload against `ZSurvey` but hands on the payload itself, not the
  // parsed copy, so the validated path needs the same guard.
  test.each(PAYLOADS)("updateSurvey (validated) drops %s", async (_name, buildExtra) => {
    const before = await snapshot();
    const survey = await loadSurvey(ids.draft);

    await updateSurvey({ ...survey, ...buildExtra(), name: "Saved" });

    expect(await snapshot()).toEqual(before);
    expect((await loadSurvey(ids.draft)).name).toBe("Saved");
  });
});
