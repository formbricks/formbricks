import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { putResponseHandler } from "@/app/api/v1/client/[workspaceId]/responses/[responseId]/lib/put-response-handler";
import { POST as postV2 } from "@/app/api/v2/client/[workspaceId]/responses/route";
import { setScopedResponsesOutcome } from "@/app/api/v3/responses/lib/write-service";
import { resetDb } from "@/integration/reset-db";

/**
 * Mark as low quality before the first question (ENG-6952), against a real Postgres. A rule before the
 * first question reads a URL parameter as the survey loads; when it marks the response, the survey
 * sends `markLowQuality: true` with the response's first write: the create of the first page, or the
 * finished create of a screen-out. The server side is ENG-6933's, unchanged: the flag sets the Low
 * quality outcome one way (ADR 0022).
 *
 * The request bodies are what the survey's response queue sends. Only the pipeline (webhooks,
 * integrations), the inline Hub drain and the audit log are stubbed; the routes and the database are
 * real.
 */
vi.mock("@/app/lib/pipelines", () => ({ sendToPipeline: vi.fn(async () => undefined) }));
vi.mock("@/modules/deletion-cleanup/lib/drain", () => ({
  drainDeletionCleanups: vi.fn(async () => ({ done: 0, again: 0, failed: 0 })),
}));
vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({
  queueAuditEvent: vi.fn(async () => undefined),
}));

beforeEach(async () => {
  await resetDb();
  vi.clearAllMocks();
});

const SOURCE = "source";
const ELEMENT = "hours";
const SCREENED_OUT_ENDING = "screenoutending000000001";
const BAD_PANEL = "known-bad-panel";
const EXCLUDED_PANEL = "excluded-panel";

const sourceEquals = (prefix: string, value: string) => ({
  id: `${prefix}group000000001`,
  connector: "and",
  conditions: [
    {
      id: `${prefix}cond0000000001`,
      leftOperand: { type: "hiddenField", value: SOURCE },
      operator: "equals",
      rightOperand: { type: "static", value },
    },
  ],
});

const seed = async () => {
  const organization = await prisma.organization.create({
    data: {
      name: "ACME Inc.",
      billing: { create: { limits: { projects: null, monthly: { responses: null, miu: null } } } },
    },
  });
  const workspace = await prisma.workspace.create({
    data: { name: "Retail Banking", organizationId: organization.id },
  });
  // A feedback directory is a Hub tenant: without one there is nothing to reconcile and nothing is queued.
  const directory = await prisma.feedbackDirectory.create({
    data: { name: "Main", organizationId: organization.id },
  });
  const survey = await prisma.survey.create({
    data: {
      name: "Streaming services 2026",
      type: "link",
      status: "inProgress",
      workspaceId: workspace.id,
      blocks: [
        {
          id: "heavyusersblock000000001",
          name: "Heavy users",
          elements: [
            {
              id: ELEMENT,
              type: "openText",
              headline: { default: "How many hours a week do you stream?" },
              required: false,
              inputType: "number",
              charLimit: { enabled: false },
            },
          ],
        },
      ],
      endings: [
        { id: "thanksending000000000001", type: "endScreen", headline: { default: "Thanks!" } },
        { id: SCREENED_OUT_ENDING, type: "endScreen", headline: { default: "This survey isn't for you" } },
      ],
      startLogic: [
        {
          id: "screenoutrule00000000001",
          conditions: sourceEquals("screenout", EXCLUDED_PANEL),
          actions: [
            { id: "screenoutjump00000000001", objective: "jumpToBlock", target: SCREENED_OUT_ENDING },
            { id: "screenoutmark00000000001", objective: "markLowQuality" },
          ],
        },
        {
          id: "badpanelrule000000000001",
          conditions: sourceEquals("badpanel0", BAD_PANEL),
          actions: [{ id: "badpanelaction0000000001", objective: "markLowQuality" }],
        },
      ],
    },
    select: { id: true },
  });

  // The URL parameter is declared, so the create keeps it in `data`, as a real survey's does.
  const field = await prisma.embeddedData.create({
    data: {
      name: SOURCE,
      source: "ingested",
      dataType: "string",
      workspaceId: workspace.id,
      surveyId: survey.id,
    },
  });
  await prisma.surveyEmbeddedData.create({
    data: {
      workspaceId: workspace.id,
      surveyId: survey.id,
      embeddedDataId: field.id,
      storageKey: SOURCE,
      order: 0,
    },
  });

  return { workspaceId: workspace.id, surveyId: survey.id, directoryId: directory.id };
};

const create = (workspaceId: string, body: Record<string, unknown>) =>
  postV2(
    new Request(`http://localhost/api/v2/client/${workspaceId}/responses`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ workspaceId }) }
  );

const update = async (workspaceId: string, responseId: string, body: Record<string, unknown>) =>
  (
    await putResponseHandler({
      req: new Request(`http://localhost/api/v1/client/${workspaceId}/responses/${responseId}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
      props: { params: Promise.resolve({ workspaceId, responseId }) },
    } as never)
  ).response;

const createdId = async (res: Response) => {
  expect(res.status).toBe(200);
  return ((await res.json()) as { data: { id: string } }).data.id;
};

const responseOf = (responseId: string) =>
  prisma.response.findUniqueOrThrow({
    where: { id: responseId },
    select: { outcome: true, finished: true, endingId: true, data: true },
  });

const queuedReconciles = () =>
  prisma.deletionCleanup.findMany({
    where: { kind: "hubResponseOutcome" },
    select: { responseIds: true, tenantIds: true, surveyId: true },
  });

describe("Mark as low quality before the first question (ENG-6952)", () => {
  test("the first page's create carries the flag: the response is Low quality, its answers kept", async () => {
    const { workspaceId, surveyId, directoryId } = await seed();

    const responseId = await createdId(
      await create(workspaceId, {
        surveyId,
        finished: false,
        data: { [SOURCE]: BAD_PANEL, [ELEMENT]: 12 },
        markLowQuality: true,
      })
    );

    await expect(responseOf(responseId)).resolves.toEqual({
      outcome: "lowQuality",
      finished: false,
      endingId: null,
      data: { [SOURCE]: BAD_PANEL, [ELEMENT]: 12 },
    });
    expect(await queuedReconciles()).toEqual([
      { responseIds: [responseId], tenantIds: [directoryId], surveyId },
    ]);
  }, 30_000);

  test("a screen-out's finished response carries the flag when the same rules marked it", async () => {
    const { workspaceId, surveyId } = await seed();

    const responseId = await createdId(
      await create(workspaceId, {
        surveyId,
        finished: true,
        endingId: SCREENED_OUT_ENDING,
        data: { [SOURCE]: EXCLUDED_PANEL },
        variables: {},
        ttc: {},
        language: "default",
        markLowQuality: true,
      })
    );

    await expect(responseOf(responseId)).resolves.toEqual({
      outcome: "lowQuality",
      finished: true,
      endingId: SCREENED_OUT_ENDING,
      data: { [SOURCE]: EXCLUDED_PANEL },
    });
  }, 30_000);

  test("a reviewer's restore holds: the session's later writes, which don't repeat the flag, leave it", async () => {
    const { workspaceId, surveyId } = await seed();
    const responseId = await createdId(
      await create(workspaceId, {
        surveyId,
        finished: false,
        data: { [SOURCE]: BAD_PANEL },
        markLowQuality: true,
      })
    );

    await setScopedResponsesOutcome([responseId], null, { workspaceId });
    expect((await update(workspaceId, responseId, { finished: true, data: { [ELEMENT]: 9 } })).status).toBe(
      200
    );

    expect((await responseOf(responseId)).outcome).toBeNull();
  }, 30_000);
});
