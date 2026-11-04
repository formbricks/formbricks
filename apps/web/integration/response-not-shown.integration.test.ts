import { beforeEach, describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";
import { ZClientResponseUpdateInput } from "@formbricks/types/responses";
import {
  SURVEY_FLOW_FIXTURE_IDS,
  surveyFlowFixture,
  surveyFlowFixtureNotShown,
} from "@formbricks/types/surveys/test-fixtures/survey-flow-fixture";
import { updateResponseWithQuotaEvaluation } from "@/app/api/v1/client/[workspaceId]/responses/[responseId]/lib/response";
import { createResponseWithQuotaEvaluation as createV1Response } from "@/app/api/v1/client/[workspaceId]/responses/lib/response";
import { createResponseWithQuotaEvaluation as createV2Response } from "@/app/api/v2/client/[workspaceId]/responses/lib/response";
import { ZResponseInputV2 } from "@/app/api/v2/client/[workspaceId]/responses/types/response";
import { resetDb } from "@/integration/reset-db";

/**
 * The not-shown record on the client response routes (ENG-6936, ADR 0024), against real Postgres:
 * the survey sends it with its create and every update, the server stores it, replaces it on update,
 * and removes the answers it lists. Every other part of a stored response is written as before.
 */

const { heavyUsers } = SURVEY_FLOW_FIXTURE_IDS.blocks;

beforeEach(async () => {
  await resetDb();
});

const seed = async () => {
  const organization = await prisma.organization.create({ data: { name: "ACME Inc." } });
  const workspace = await prisma.workspace.create({
    data: { name: "Retail Banking", organizationId: organization.id },
  });
  const survey = await prisma.survey.create({
    data: {
      name: surveyFlowFixture.name,
      type: "link",
      status: "inProgress",
      workspaceId: workspace.id,
      blocks: surveyFlowFixture.blocks,
    },
    select: { id: true },
  });
  return { workspaceId: workspace.id, surveyId: survey.id };
};

const readStored = (id: string) =>
  prisma.response.findUniqueOrThrow({
    where: { id },
    select: { data: true, notShown: true, finished: true, ttc: true, variables: true },
  });

const createInput = (workspaceId: string, surveyId: string) => ({
  workspaceId,
  surveyId,
  finished: false,
  data: { services: ["Netflix"], panel_id: "p-1" },
  ttc: { services: 1200 },
  variables: {},
  meta: {},
  singleUseId: null,
  displayId: null,
});

describe("client response create", () => {
  test("v1 stores the record the survey sends", async () => {
    const { workspaceId, surveyId } = await seed();

    const created = await createV1Response({
      ...createInput(workspaceId, surveyId),
      userId: null,
      notShown: surveyFlowFixtureNotShown,
    });

    await expect(readStored(created.id)).resolves.toMatchObject({ notShown: surveyFlowFixtureNotShown });
  });

  test("v2 stores the record the survey sends", async () => {
    const { workspaceId, surveyId } = await seed();
    const input = ZResponseInputV2.parse({
      ...createInput(workspaceId, surveyId),
      contactId: null,
      notShown: surveyFlowFixtureNotShown,
    });

    const created = await createV2Response(input);

    await expect(readStored(created.id)).resolves.toMatchObject({ notShown: surveyFlowFixtureNotShown });
  });

  test("v1 and v2 remove the answers the record lists on create, as an update does", async () => {
    const { workspaceId, surveyId } = await seed();
    // `hours` sits in the skipped block and `apple_reason` is hidden in the fixture's record.
    const data = { services: ["Netflix"], hours: "12", apple_reason: "Price", panel_id: "p-1" };

    const v1 = await createV1Response({
      ...createInput(workspaceId, surveyId),
      data,
      userId: null,
      notShown: surveyFlowFixtureNotShown,
    });
    const v2 = await createV2Response(
      ZResponseInputV2.parse({
        ...createInput(workspaceId, surveyId),
        data,
        contactId: null,
        notShown: surveyFlowFixtureNotShown,
      })
    );

    for (const created of [v1, v2]) {
      await expect(readStored(created.id)).resolves.toMatchObject({
        data: { services: ["Netflix"], panel_id: "p-1" },
      });
      expect((await readStored(created.id)).data).not.toHaveProperty("hours");
      expect((await readStored(created.id)).data).not.toHaveProperty("apple_reason");
    }
  });

  test("a create without a record (an older bundle) leaves it unknown", async () => {
    const { workspaceId, surveyId } = await seed();

    const created = await createV1Response({ ...createInput(workspaceId, surveyId), userId: null });

    await expect(readStored(created.id)).resolves.toMatchObject({ notShown: null });
  });
});

describe("client response update", () => {
  const seedAnswered = async () => {
    const { surveyId } = await seed();
    // A respondent who first picked all three big services, answered "Heavy users" and wrote why
    // Apple TV+ would convince them, then went Back and changed both answers.
    const response = await prisma.response.create({
      data: {
        surveyId,
        finished: false,
        data: {
          services: ["Netflix", "Disney+", "Prime Video"],
          hours: "12",
          fav: "Apple TV+",
          apple_reason: "Price",
          panel_id: "p-1",
          verifiedEmail: "ana@example.com",
        },
        ttc: { services: 1200, hours: 900 },
        variables: { [SURVEY_FLOW_FIXTURE_IDS.variables.score]: 3 },
      },
      select: { id: true },
    });
    return { surveyId, responseId: response.id };
  };

  test("stores the record and removes the answers of every element and block it lists", async () => {
    const { surveyId, responseId } = await seedAnswered();

    await updateResponseWithQuotaEvaluation(
      responseId,
      surveyId,
      ZClientResponseUpdateInput.parse({
        finished: false,
        data: { services: ["Netflix"], fav: "Netflix" },
        ttc: { fav: 700 },
        notShown: surveyFlowFixtureNotShown,
      })
    );

    const stored = await readStored(responseId);
    expect(stored.notShown).toEqual(surveyFlowFixtureNotShown);
    // `hours` (in the skipped block) and `apple_reason` (hidden) are gone; everything else, the hidden
    // field and the verified email included, is merged exactly as before.
    expect(stored.data).toEqual({
      services: ["Netflix"],
      fav: "Netflix",
      panel_id: "p-1",
      verifiedEmail: "ana@example.com",
    });
    expect(stored.ttc).toEqual({ services: 1200, hours: 900, fav: 700 });
    expect(stored.variables).toEqual({ [SURVEY_FLOW_FIXTURE_IDS.variables.score]: 3 });
  });

  test("replaces the stored record, so an item shown again after Back drops out of it", async () => {
    const { surveyId, responseId } = await seedAnswered();
    await updateResponseWithQuotaEvaluation(responseId, surveyId, {
      finished: false,
      data: {},
      notShown: { blocks: [heavyUsers], elements: ["apple_reason"] },
    });

    await updateResponseWithQuotaEvaluation(responseId, surveyId, {
      finished: false,
      data: { fav: "Apple TV+", apple_reason: "Bundles" },
      notShown: { blocks: [heavyUsers] },
    });

    const stored = await readStored(responseId);
    expect(stored.notShown).toEqual({ blocks: [heavyUsers] });
    expect(stored.data).toMatchObject({ fav: "Apple TV+", apple_reason: "Bundles" });
  });

  test("never removes a key that is not an element of the survey", async () => {
    const { surveyId, responseId } = await seedAnswered();

    await updateResponseWithQuotaEvaluation(responseId, surveyId, {
      finished: false,
      data: {},
      notShown: { elements: ["verifiedEmail", "panel_id"] },
    });

    await expect(readStored(responseId)).resolves.toMatchObject({
      data: { panel_id: "p-1", verifiedEmail: "ana@example.com" },
    });
  });

  test("an update without a record (an older bundle) merges as before and keeps the stored one", async () => {
    const { surveyId, responseId } = await seedAnswered();
    await prisma.response.update({ where: { id: responseId }, data: { notShown: { elements: ["email"] } } });

    await updateResponseWithQuotaEvaluation(responseId, surveyId, {
      finished: true,
      data: { bundle: "Yes" },
    });

    const stored = await readStored(responseId);
    expect(stored.notShown).toEqual({ elements: ["email"] });
    expect(stored.data).toMatchObject({ hours: "12", apple_reason: "Price", bundle: "Yes" });
  });

  test("the updated response the pipeline and webhooks receive carries no record", async () => {
    const { surveyId, responseId } = await seedAnswered();

    const updated = await updateResponseWithQuotaEvaluation(responseId, surveyId, {
      finished: true,
      data: {},
      notShown: surveyFlowFixtureNotShown,
    });

    expect(updated).not.toHaveProperty("notShown");
  });
});
