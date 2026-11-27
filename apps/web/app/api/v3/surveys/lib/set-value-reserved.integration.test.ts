import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";
import { synchronizeAuthzedIntegrationFixture } from "@/integration/authzed";
import { resetDb } from "@/integration/reset-db";
import { clearProjectionScopeReady, setProjectionScopeReady } from "@/lib/authzed/scope-readiness";
import { createV3SurveyResponseFromRawInput, getV3Survey, patchV3SurveyResponse } from "./operations";

/**
 * ENG-7431: the one-step "set to a metadata value" shape API and MCP clients send, through the real v3
 * create, read and patch against Postgres and SpiceDB. Both logic engines read it now; this pins that the
 * API keeps it exactly as sent at every step, so what an engine reads is what the client wrote.
 */

const ids = { organization: "", workspace: "", owner: "" };
const session = (userId: string) => ({ expires: "2099-01-01", user: { id: userId } }) as never;
const instance = "/api/v3/surveys";

const fromPagesViewed = {
  id: "setpages",
  objective: "calculate",
  variableId: "pagesseen",
  operator: "assign",
  value: { type: "reserved", value: "visitPagesViewed" },
};
const addPagePath = {
  id: "setpath",
  objective: "calculate",
  variableId: "landingpath",
  operator: "concat",
  value: { type: "reserved", value: "pagePath" },
};
const blockWith = (actions: unknown[]) => ({
  id: "blockmain",
  name: "Main",
  elements: [{ id: "q1", type: "openText", headline: { "en-US": "Anything?" }, required: true }],
  logic: [
    {
      id: "logicmain",
      conditions: {
        id: "groupmain",
        connector: "and",
        conditions: [
          { id: "condmain", leftOperand: { type: "element", value: "q1" }, operator: "isSubmitted" },
        ],
      },
      actions,
    },
  ],
});

const actionsOf = async (surveyId: string) => {
  const response = await getV3Survey({
    surveyId,
    authentication: session(ids.owner),
    requestId: "req",
    instance,
  });
  expect(response.status).toBe(200);
  const body = (await response.json()) as {
    data: { blocks: Array<{ logic?: Array<{ actions: unknown[] }> }> };
  };
  return body.data.blocks[0].logic?.[0].actions;
};

beforeAll(async () => {
  await resetDb();
  const organization = await prisma.organization.create({ data: { name: "Set value reserved" } });
  const workspace = await prisma.workspace.create({
    data: { name: "Set value reserved", organizationId: organization.id },
  });
  const owner = await prisma.user.create({
    data: { email: "owner@set-value-reserved.test", name: "Owner" },
  });
  await prisma.membership.create({
    data: { accepted: true, organizationId: organization.id, role: "owner", userId: owner.id },
  });
  ids.organization = organization.id;
  ids.workspace = workspace.id;
  ids.owner = owner.id;

  await synchronizeAuthzedIntegrationFixture();
  await setProjectionScopeReady("survey", "integration");
}, 120_000);

afterAll(async () => {
  await clearProjectionScopeReady("survey");
});

describe("a one-step Set value from a reserved (metadata) field (ENG-7431)", () => {
  test("create stores it, read returns it, and a patch keeps it, exactly as sent", async () => {
    const created = await createV3SurveyResponseFromRawInput({
      body: {
        workspaceId: ids.workspace,
        name: "Pages seen",
        variables: [
          { id: "pagesseen", name: "pages_seen", type: "number", value: 0 },
          { id: "landingpath", name: "landing_path", type: "text", value: "" },
        ],
        blocks: [blockWith([fromPagesViewed])],
      },
      authentication: session(ids.owner),
      requestId: "req",
      instance,
    });
    expect(created.status).toBe(201);
    const surveyId = ((await created.json()) as { data: { id: string } }).data.id;

    expect(await actionsOf(surveyId)).toEqual([fromPagesViewed]);

    const patched = await patchV3SurveyResponse({
      surveyId,
      body: { blocks: [blockWith([fromPagesViewed, addPagePath])] },
      authentication: session(ids.owner),
      requestId: "req",
      instance,
    });
    expect(patched.status).toBe(200);
    expect(await actionsOf(surveyId)).toEqual([fromPagesViewed, addPagePath]);
  });
});
