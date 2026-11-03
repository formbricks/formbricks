import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { putResponseHandler } from "@/app/api/v1/client/[workspaceId]/responses/[responseId]/lib/put-response-handler";
import { createResponseWithQuotaEvaluation as createV1Response } from "@/app/api/v1/client/[workspaceId]/responses/lib/response";
import { POST as postV2 } from "@/app/api/v2/client/[workspaceId]/responses/route";
import { setScopedResponsesOutcome } from "@/app/api/v3/responses/lib/write-service";
import { resetDb } from "@/integration/reset-db";

/**
 * Mark as low quality from the survey (ENG-6933, ADR 0022/0023), against a real Postgres. A rule's action
 * makes the survey send `markLowQuality: true` with its next create or update. The server sets the outcome
 * to Low quality and queues the Hub reconcile (`hubResponseOutcome`), as a reviewer marking it does. The
 * flag is one way: it never clears an outcome, and any other value is refused.
 *
 * Only the pipeline (webhooks, integrations) is stubbed; the routes, the outcome write and the queue are
 * real. The drain that works the queue is covered by `response-outcome-cleanup.integration.test.ts`.
 */
vi.mock("@/app/lib/pipelines", () => ({ sendToPipeline: vi.fn(async () => undefined) }));
// The v3 restore drains its row inline; the Hub itself is not part of this test.
vi.mock("@/modules/deletion-cleanup/lib/drain", () => ({
  drainDeletionCleanups: vi.fn(async () => ({ done: 0, again: 0, failed: 0 })),
}));

beforeEach(async () => {
  await resetDb();
  vi.clearAllMocks();
});

const ELEMENT = "hours";

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
          logic: [
            {
              id: "lowqualityrule0000000001",
              conditions: {
                id: "lowqualitygroup000000001",
                connector: "and",
                conditions: [
                  {
                    id: "lowqualitycond0000000001",
                    leftOperand: { type: "element", value: ELEMENT },
                    operator: "isGreaterThan",
                    rightOperand: { type: "static", value: 112 },
                  },
                ],
              },
              actions: [{ id: "lowqualityaction00000001", objective: "markLowQuality" }],
            },
          ],
        },
      ],
      endings: [{ id: "thanksending000000000001", type: "endScreen", headline: { default: "Thanks!" } }],
    },
    select: { id: true },
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

const createUnfinished = async (workspaceId: string, surveyId: string) => {
  const res = await create(workspaceId, { surveyId, finished: false, data: { [ELEMENT]: 10 } });
  expect(res.status).toBe(200);
  return ((await res.json()) as { data: { id: string } }).data.id;
};

const outcomeOf = async (responseId: string) =>
  (await prisma.response.findUniqueOrThrow({ where: { id: responseId }, select: { outcome: true } })).outcome;

const queuedReconciles = () =>
  prisma.deletionCleanup.findMany({
    where: { kind: "hubResponseOutcome" },
    select: { responseIds: true, tenantIds: true, surveyId: true },
  });

describe("Mark as low quality from the survey (ENG-6933)", () => {
  test("an update with the flag sets Low quality and queues the Hub reconcile", async () => {
    const { workspaceId, surveyId, directoryId } = await seed();
    const responseId = await createUnfinished(workspaceId, surveyId);

    const res = await update(workspaceId, responseId, {
      finished: true,
      data: { [ELEMENT]: 140 },
      markLowQuality: true,
    });

    expect(res.status).toBe(200);
    expect(await outcomeOf(responseId)).toBe("lowQuality");
    expect(await queuedReconciles()).toEqual([
      { responseIds: [responseId], tenantIds: [directoryId], surveyId },
    ]);
    // The answers are stored as always: the respondent carried on.
    await expect(
      prisma.response.findUniqueOrThrow({ where: { id: responseId }, select: { finished: true, data: true } })
    ).resolves.toEqual({ finished: true, data: { [ELEMENT]: 140 } });
  });

  test("a create with the flag sets Low quality and queues the Hub reconcile, on v2 and v1", async () => {
    const { workspaceId, surveyId } = await seed();

    const res = await create(workspaceId, {
      surveyId,
      finished: false,
      data: { [ELEMENT]: 140 },
      markLowQuality: true,
    });
    expect(res.status).toBe(200);
    const v2Id = ((await res.json()) as { data: { id: string } }).data.id;

    const v1 = await createV1Response({
      workspaceId,
      surveyId,
      finished: false,
      data: { [ELEMENT]: 150 },
      markLowQuality: true,
    });

    expect(await outcomeOf(v2Id)).toBe("lowQuality");
    expect(v1.outcome).toBe("lowQuality");
    expect(await outcomeOf(v1.id)).toBe("lowQuality");
    expect((await queuedReconciles()).map((row) => row.responseIds).sort()).toEqual([[v1.id], [v2Id]].sort());
  });

  test("responses without the flag are unchanged: no outcome, nothing queued", async () => {
    const { workspaceId, surveyId } = await seed();
    const responseId = await createUnfinished(workspaceId, surveyId);

    expect((await update(workspaceId, responseId, { finished: true, data: { [ELEMENT]: 12 } })).status).toBe(
      200
    );

    expect(await outcomeOf(responseId)).toBeNull();
    expect(await queuedReconciles()).toEqual([]);
  });

  test("refuses any value of the flag but true, and changes nothing", async () => {
    const { workspaceId, surveyId } = await seed();
    const responseId = await createUnfinished(workspaceId, surveyId);

    for (const markLowQuality of [false, null, "lowQuality", 1]) {
      expect((await update(workspaceId, responseId, { finished: false, markLowQuality })).status).toBe(400);
      expect(
        (await create(workspaceId, { surveyId, finished: false, data: {}, markLowQuality })).status
      ).toBe(400);
    }

    expect(await prisma.response.count({ where: { surveyId } })).toBe(1);
    expect(await outcomeOf(responseId)).toBeNull();
    expect(await queuedReconciles()).toEqual([]);
  });

  test("the survey can't clear the outcome or set it another way", async () => {
    const { workspaceId, surveyId } = await seed();
    const responseId = await createUnfinished(workspaceId, surveyId);
    expect((await update(workspaceId, responseId, { finished: false, markLowQuality: true })).status).toBe(
      200
    );
    const queuedOnce = await queuedReconciles();

    // `outcome` is not part of the client update (#9847): it is ignored, whatever it says.
    expect((await update(workspaceId, responseId, { finished: false, outcome: null })).status).toBe(200);
    expect(await outcomeOf(responseId)).toBe("lowQuality");

    // Marking it again changes nothing, so nothing new is queued.
    expect((await update(workspaceId, responseId, { finished: false, markLowQuality: true })).status).toBe(
      200
    );
    expect(await queuedReconciles()).toEqual(queuedOnce);

    // Nor can a create set it through `outcome`.
    const created = await create(workspaceId, { surveyId, finished: false, data: {}, outcome: "lowQuality" });
    const createdId = ((await created.json()) as { data: { id: string } }).data.id;
    expect(await outcomeOf(createdId)).toBeNull();
  });

  test("a reviewer restores a response a rule marked, like any Low quality response", async () => {
    const { workspaceId, surveyId } = await seed();
    const responseId = await createUnfinished(workspaceId, surveyId);
    expect((await update(workspaceId, responseId, { finished: false, markLowQuality: true })).status).toBe(
      200
    );

    const restored = await setScopedResponsesOutcome([responseId], null, { workspaceId });

    expect(restored.changes).toHaveLength(1);
    expect(await outcomeOf(responseId)).toBeNull();
    // The restore's own reconcile replaced the mark's: one row, which rebuilds the records.
    expect((await queuedReconciles()).map((row) => row.responseIds)).toEqual([[responseId]]);

    // The respondent finishing afterwards, without the rule firing again, leaves it restored.
    expect((await update(workspaceId, responseId, { finished: true, data: { [ELEMENT]: 9 } })).status).toBe(
      200
    );
    expect(await outcomeOf(responseId)).toBeNull();
  });
});
