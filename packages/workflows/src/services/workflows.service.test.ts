import { beforeEach, describe, expect, test, vi } from "vitest";
import type { WorkflowDelegate, WorkflowRowWithLastRun, WorkflowsDb } from "./ports";
import { createWorkflowsService } from "./workflows.service";

const surveyId = "cm9zr4q7i000108l84gozfggr";
const workspaceId = "cm9zr4mps000008l8btfy1vtz";

const definition = {
  schemaVersion: 1 as const,
  trigger: {
    id: "trigger",
    type: "trigger" as const,
    triggerType: "response.completed" as const,
    config: { surveyId, endingCardIds: [] },
  },
  nodes: [
    {
      id: "send-email",
      type: "action" as const,
      actionType: "send_email" as const,
      config: {
        from: "noreply@example.com",
        to: "support@example.com",
        replyTo: ["support@example.com"],
        subject: "Thanks",
        body: "Thanks for your response.",
        attachResponseData: true,
      },
    },
  ],
  edges: [{ id: "e1", source: "trigger", target: "send-email" }],
  entryNodeId: "trigger",
};

const makeRow = (overrides: Partial<WorkflowRowWithLastRun> = {}): WorkflowRowWithLastRun => ({
  id: "cm9zr4t2b000208l8h2m1aq3c",
  createdAt: new Date("2026-06-11T09:30:00.000Z"),
  updatedAt: new Date("2026-06-12T09:30:00.000Z"),
  name: "Notify team",
  description: null,
  status: "draft",
  workspaceId,
  createdBy: null,
  definition,
  runs: [],
  ...overrides,
});

const findMany = vi.fn<WorkflowDelegate["findMany"]>();
const findUnique = vi.fn<WorkflowDelegate["findUnique"]>();
const create = vi.fn<WorkflowDelegate["create"]>();
const prisma: WorkflowsDb = { workflow: { findMany, findUnique, create } };
const service = createWorkflowsService({ prisma });

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createWorkflow", () => {
  test("persists a draft with createdBy from the caller", async () => {
    const row = makeRow();
    create.mockResolvedValue(row);

    const result = await service.createWorkflow(
      { workspaceId, name: "Notify team", definition },
      { createdBy: "cm9zr52kh000508l8e3q7bw9j" }
    );

    const createArgs = create.mock.calls[0][0];
    expect(createArgs.data).toMatchObject({
      workspaceId,
      name: "Notify team",
      status: "draft",
      createdBy: "cm9zr52kh000508l8e3q7bw9j",
    });
    expect(createArgs.include).toEqual({ runs: { take: 1, orderBy: { createdAt: "desc" } } });
    expect(result).toBe(row);
  });

  test("stores createdBy as null for API-key callers", async () => {
    create.mockResolvedValue(makeRow());
    await service.createWorkflow({ workspaceId, name: "X", definition }, { createdBy: null });
    expect(create.mock.calls[0][0].data.createdBy).toBeNull();
  });
});

describe("listWorkflows", () => {
  test("excludes archived workflows by default and over-fetches by one", async () => {
    findMany.mockResolvedValue([makeRow()]);

    const page = await service.listWorkflows({ workspaceId, limit: 20, sortBy: "updatedAt" });

    const findManyArgs = findMany.mock.calls[0][0];
    expect(findManyArgs.where).toMatchObject({ workspaceId, status: { not: "archived" } });
    expect(findManyArgs.take).toBe(21);
    expect(findManyArgs.orderBy).toEqual([{ updatedAt: "desc" }, { id: "desc" }]);
    expect(page.nextCursor).toBeNull();
    expect(page.workflows).toHaveLength(1);
  });

  test("honors an explicit status filter", async () => {
    findMany.mockResolvedValue([]);
    await service.listWorkflows({
      workspaceId,
      limit: 20,
      sortBy: "updatedAt",
      statusIn: ["draft", "disabled"],
    });
    expect(findMany.mock.calls[0][0].where).toMatchObject({ status: { in: ["draft", "disabled"] } });
  });

  test("applies a case-insensitive name filter", async () => {
    findMany.mockResolvedValue([]);
    await service.listWorkflows({ workspaceId, limit: 20, sortBy: "name", nameContains: "csat" });
    const findManyArgs = findMany.mock.calls[0][0];
    expect(findManyArgs.where).toMatchObject({ name: { contains: "csat", mode: "insensitive" } });
    expect(findManyArgs.orderBy).toEqual([{ name: "asc" }, { id: "asc" }]);
  });

  test("returns a next cursor when there are more rows than the limit", async () => {
    const rows = [
      makeRow({ id: "cm9zr4t2b000208l8h2m1aq30", updatedAt: new Date("2026-06-12T09:30:00.000Z") }),
      makeRow({ id: "cm9zr4t2b000208l8h2m1aq31", updatedAt: new Date("2026-06-11T09:30:00.000Z") }),
      makeRow({ id: "cm9zr4t2b000208l8h2m1aq32", updatedAt: new Date("2026-06-10T09:30:00.000Z") }),
    ];
    findMany.mockResolvedValue(rows);

    const page = await service.listWorkflows({ workspaceId, limit: 2, sortBy: "updatedAt" });

    expect(page.workflows).toHaveLength(2);
    expect(page.nextCursor).toEqual(expect.any(String));
  });
});

describe("getWorkflowById", () => {
  test("loads a single row by id with its last run", async () => {
    const row = makeRow();
    findUnique.mockResolvedValue(row);

    expect(await service.getWorkflowById(row.id)).toBe(row);
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: row.id },
      include: { runs: { take: 1, orderBy: { createdAt: "desc" } } },
    });
  });

  test("returns null when the workflow does not exist", async () => {
    findUnique.mockResolvedValue(null);
    expect(await service.getWorkflowById("missing")).toBeNull();
  });
});
