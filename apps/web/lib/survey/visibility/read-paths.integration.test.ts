import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";
import { getResponsesByWorkspaceIds } from "@/app/api/v1/management/responses/lib/response";
import { getSurveys as getV1Surveys } from "@/app/api/v1/management/surveys/lib/surveys";
import { synchronizeAuthzedIntegrationFixture } from "@/integration/authzed";
import { resetDb } from "@/integration/reset-db";
import {
  clearProjectionScopeReady,
  resetSurveyVisibilityReadinessMemo,
  setProjectionScopeReady,
} from "@/lib/authzed/scope-readiness";
import { getResponsesByContactId } from "@/lib/response/service";
import { getSurveys } from "@/lib/survey/service";
import { getTagsOnResponsesCount } from "@/lib/tagOnResponse/service";
import { getResponses as getV2Responses } from "@/modules/api/v2/management/responses/lib/response";
import { getSurveysWithSlugsByOrganizationId } from "@/modules/survey/lib/slug";
import { getUserVisibleSurveyWhere } from "./actor-context";
import { canApiKeyReachSurveyResource, getApiKeyVisibleSurveyWhere } from "./api-key";

/**
 * ENG-3282, Gate E: the read paths outside `/api/v3/surveys` against a real PostgreSQL and SpiceDB.
 * Four principals — the survey's owner, an organization manager, a plain read member and a manage-level
 * API key — over one workspace-visible and one private survey, each with a tagged response from the
 * same contact. With the marker off every path returns exactly what it returned before.
 */
const ids = {
  apiKey: "",
  contact: "",
  manager: "",
  member: "",
  organization: "",
  owner: "",
  privateSurvey: "",
  tag: "",
  visibleSurvey: "",
  workspace: "",
};

const setMarker = async (ready: boolean): Promise<void> => {
  await (ready ? setProjectionScopeReady("survey", "integration") : clearProjectionScopeReady("survey"));
  resetSurveyVisibilityReadinessMemo();
};

const bothSurveys = () => [ids.visibleSurvey, ids.privateSurvey].sort();

const idsOf = (rows: ReadonlyArray<{ id: string }>) => rows.map(({ id }) => id).sort();
const surveyIdsOf = (rows: ReadonlyArray<{ surveyId: string }>) =>
  [...new Set(rows.map(({ surveyId }) => surveyId))].sort();

beforeAll(async () => {
  await resetDb();
  const organization = await prisma.organization.create({ data: { name: "Read Paths Org" } });
  const workspace = await prisma.workspace.create({
    data: { name: "Read Paths", organizationId: organization.id },
  });
  ids.organization = organization.id;
  ids.workspace = workspace.id;

  const makeUser = async (label: string, role: "manager" | "member", permission?: "read" | "readWrite") => {
    const user = await prisma.user.create({ data: { email: `${label}@read-paths.test`, name: label } });
    await prisma.membership.create({
      data: { accepted: true, organizationId: organization.id, role, userId: user.id },
    });
    if (permission) {
      const team = await prisma.team.create({ data: { name: label, organizationId: organization.id } });
      await prisma.teamUser.create({ data: { role: "contributor", teamId: team.id, userId: user.id } });
      await prisma.workspaceTeam.create({ data: { permission, teamId: team.id, workspaceId: workspace.id } });
    }
    return user.id;
  };
  ids.owner = await makeUser("owner", "member", "readWrite");
  ids.member = await makeUser("member", "member", "read");
  ids.manager = await makeUser("manager", "manager");

  const apiKey = await prisma.apiKey.create({
    data: { hashedKey: "read-paths-hash", label: "key", organizationId: organization.id },
  });
  await prisma.apiKeyWorkspace.create({
    data: { apiKeyId: apiKey.id, permission: "manage", workspaceId: workspace.id },
  });
  ids.apiKey = apiKey.id;

  const contact = await prisma.contact.create({ data: { workspaceId: workspace.id } });
  const tag = await prisma.tag.create({ data: { name: "Flagged", workspaceId: workspace.id } });
  ids.contact = contact.id;
  ids.tag = tag.id;

  const survey = async (name: string, visibility: "private" | "workspace") => {
    const created = await prisma.survey.create({
      data: { name, ownerId: ids.owner, slug: `${visibility}-slug`, visibility, workspaceId: workspace.id },
    });
    await prisma.response.create({
      data: {
        contactId: contact.id,
        data: {},
        finished: true,
        surveyId: created.id,
        tags: { create: { tagId: tag.id } },
      },
    });
    return created.id;
  };
  ids.visibleSurvey = await survey("Visible", "workspace");
  ids.privateSurvey = await survey("Private", "private");

  await synchronizeAuthzedIntegrationFixture();
}, 120_000);

afterAll(async () => {
  await setMarker(false);
});

describe("marker off: every read path is unchanged", () => {
  beforeAll(() => setMarker(false));

  test("API keys and members see every survey, response and count", async () => {
    expect(
      idsOf(await getV1Surveys([ids.workspace], undefined, undefined, await getApiKeyVisibleSurveyWhere()))
    ).toEqual(bothSurveys());
    await expect(
      canApiKeyReachSurveyResource(ids.apiKey, "survey.read", { id: ids.privateSurvey, type: "survey" })
    ).resolves.toBe(true);

    const memberWhere = await getUserVisibleSurveyWhere(ids.member, ids.organization);
    expect(memberWhere).toEqual({});
    expect(idsOf(await getSurveys(ids.workspace, memberWhere))).toEqual(bothSurveys());
    expect(await getTagsOnResponsesCount(ids.workspace, memberWhere)).toEqual([{ count: 2, tagId: ids.tag }]);
  });
});

describe("marker on: private surveys leave every read path of those who may not see them", () => {
  beforeAll(() => setMarker(true));

  test("v1 and v2 management: an API key lists, counts and reaches workspace-visible surveys only", async () => {
    const where = await getApiKeyVisibleSurveyWhere();

    expect(idsOf(await getV1Surveys([ids.workspace], undefined, undefined, where))).toEqual([
      ids.visibleSurvey,
    ]);
    expect(
      surveyIdsOf(await getResponsesByWorkspaceIds([ids.workspace], undefined, undefined, where))
    ).toEqual([ids.visibleSurvey]);

    const v2 = await getV2Responses([ids.workspace], { limit: 50, skip: 0 } as never, where);
    if (!v2.ok) throw new Error("v2 responses read failed");
    expect(surveyIdsOf(v2.data.data)).toEqual([ids.visibleSurvey]);
    expect(v2.data.meta.total).toBe(1);

    await expect(
      canApiKeyReachSurveyResource(ids.apiKey, "survey.read", { id: ids.visibleSurvey, type: "survey" })
    ).resolves.toBe(true);
    await expect(
      canApiKeyReachSurveyResource(ids.apiKey, "survey.read", { id: ids.privateSurvey, type: "survey" })
    ).resolves.toBe(false);
    const [privateResponse] = await prisma.response.findMany({ where: { surveyId: ids.privateSurvey } });
    await expect(
      canApiKeyReachSurveyResource(ids.apiKey, "response.read", { id: privateResponse.id, type: "response" })
    ).resolves.toBe(false);
  });

  test.each([
    ["owner", () => ids.owner, true],
    ["organization manager", () => ids.manager, true],
    ["read member", () => ids.member, false],
  ] as const)(
    "pickers, slugs, contact activity and tag counts for the %s",
    async (_label, userId, seesPrivate) => {
      const where = await getUserVisibleSurveyWhere(userId(), ids.organization);
      const expected = seesPrivate ? bothSurveys() : [ids.visibleSurvey];

      expect(idsOf(await getSurveys(ids.workspace, where))).toEqual(expected);
      expect(idsOf(await getSurveysWithSlugsByOrganizationId(ids.organization, where))).toEqual(expected);
      expect(surveyIdsOf(await getResponsesByContactId(ids.contact, ids.workspace, where))).toEqual(expected);
      expect(await getTagsOnResponsesCount(ids.workspace, where)).toEqual([
        { count: expected.length, tagId: ids.tag },
      ]);
    }
  );
});
