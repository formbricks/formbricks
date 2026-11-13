import { beforeEach, describe, expect, test, vi } from "vitest";
import type {
  WebhookTokenIssuer,
  WorkflowDelegate,
  WorkflowRowWithLastRun,
  WorkflowSampleDelegate,
  WorkflowsDb,
} from "./ports";
import { createWorkflowsService } from "./workflows.service";

const workspaceId = "cm9zr4mps000008l8btfy1vtz";
const workflowId = "cm9zr4t2b000208l8h2m1aq3c";
const surveyId = "cm9zr4q7i000108l84gozfggr";

const webhookDefinition = {
  schemaVersion: 1 as const,
  trigger: { id: "trigger", type: "trigger" as const, triggerType: "webhook" as const, config: {} },
  nodes: [],
  edges: [],
  entryNodeId: "trigger",
};

const surveyDefinition = {
  ...webhookDefinition,
  trigger: {
    id: "trigger",
    type: "trigger" as const,
    triggerType: "response.completed" as const,
    config: { surveyId, endingCardIds: [] },
  },
};

const makeRow = (overrides: Partial<WorkflowRowWithLastRun> = {}): WorkflowRowWithLastRun => ({
  id: workflowId,
  createdAt: new Date("2026-11-01T09:30:00.000Z"),
  updatedAt: new Date("2026-11-02T09:30:00.000Z"),
  name: "Orders",
  description: null,
  status: "draft",
  workspaceId,
  createdBy: null,
  creator: null,
  definition: webhookDefinition,
  webhookTokenHash: "old-hash",
  webhookTokenEncrypted: "old-encrypted",
  runs: [],
  _count: { runs: 0 },
  ...overrides,
});

const create = vi.fn<WorkflowDelegate["create"]>();
const update = vi.fn<WorkflowDelegate["update"]>();
const sampleFindUnique = vi.fn<WorkflowSampleDelegate["findUnique"]>();
const sampleUpsert = vi.fn<WorkflowSampleDelegate["upsert"]>();
const workflow = {
  findMany: vi.fn(),
  findUnique: vi.fn(),
  create,
  update,
  delete: vi.fn(),
  updateMany: vi.fn(),
  count: vi.fn(),
} as unknown as WorkflowDelegate;
const prisma = {
  workflow,
  workflowVersion: {},
  workflowRun: {},
  workflowSample: { findUnique: sampleFindUnique, upsert: sampleUpsert },
  $transaction: vi.fn(),
} as unknown as WorkflowsDb;

let issued = 0;
const webhookTokens: WebhookTokenIssuer = {
  issue: () => {
    issued++;
    return { hash: `hash-${issued}`, encrypted: `encrypted-${issued}` };
  },
  reveal: (encrypted) => `token-of-${encrypted}`,
};

const service = createWorkflowsService({ prisma, webhookTokens });

beforeEach(() => {
  vi.clearAllMocks();
  issued = 0;
  create.mockResolvedValue(makeRow());
  update.mockResolvedValue(makeRow());
});

describe("Webhook Secret URL token", () => {
  test("is issued when a workflow is created with a Webhook trigger", async () => {
    await service.createWorkflow(
      { workspaceId, name: "Orders", definition: webhookDefinition },
      { createdBy: null }
    );

    expect(create.mock.calls[0][0].data).toMatchObject({
      webhookTokenHash: "hash-1",
      webhookTokenEncrypted: "encrypted-1",
    });
  });

  test("is not issued for a Response completed workflow", async () => {
    await service.createWorkflow(
      { workspaceId, name: "Survey", definition: surveyDefinition },
      { createdBy: null }
    );

    expect(create.mock.calls[0][0].data).not.toHaveProperty("webhookTokenHash");
  });

  test("is issued by an update only when asked to", async () => {
    await service.updateWorkflow(
      { workflowId, workspaceId },
      { definition: webhookDefinition, issueWebhookToken: true }
    );
    await service.updateWorkflow({ workflowId, workspaceId }, { definition: webhookDefinition });

    expect(update.mock.calls[0][0].data).toMatchObject({ webhookTokenHash: "hash-1" });
    expect(update.mock.calls[1][0].data).not.toHaveProperty("webhookTokenHash");
  });

  test("a duplicate of a Webhook workflow gets its own new token", async () => {
    await service.duplicateWorkflow(makeRow(), { createdBy: null });

    expect(create.mock.calls[0][0].data).toMatchObject({
      webhookTokenHash: "hash-1",
      webhookTokenEncrypted: "encrypted-1",
    });
  });

  test("regenerating replaces the stored hash and encrypted copy", async () => {
    await service.regenerateWebhookToken({ workflowId, workspaceId });

    expect(update.mock.calls[0][0]).toMatchObject({
      where: { id_workspaceId: { id: workflowId, workspaceId } },
      data: { webhookTokenHash: "hash-1", webhookTokenEncrypted: "encrypted-1" },
    });
  });

  test("is revealed from the encrypted copy, or null when there is none", () => {
    expect(service.revealWebhookToken(makeRow())).toBe("token-of-old-encrypted");
    expect(service.revealWebhookToken(makeRow({ webhookTokenEncrypted: null }))).toBeNull();
  });
});

describe("Sample payload", () => {
  test("is stored beside the workflow, keyed by workflow and the trigger source", async () => {
    await service.setTriggerSample({ workflowId, workspaceId }, { order: 1 });

    expect(sampleUpsert).toHaveBeenCalledWith({
      where: { workflowId_source: { workflowId, source: "trigger" } },
      create: { workflowId, workspaceId, source: "trigger", sample: { order: 1 } },
      update: { sample: { order: 1 } },
    });
    // The workflow row is never written, so the list's "last updated" order does not move.
    expect(update).not.toHaveBeenCalled();
  });

  test("is read by workflow and the trigger source", async () => {
    await service.getTriggerSample(workflowId);

    expect(sampleFindUnique).toHaveBeenCalledWith({
      where: { workflowId_source: { workflowId, source: "trigger" } },
    });
  });
});
