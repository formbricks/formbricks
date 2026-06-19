import { beforeEach, describe, expect, test, vi } from "vitest";
import { WorkflowConflictError } from "../errors";
import type { WorkflowDelegate, WorkflowRowWithLastRun, WorkflowVersionDelegate, WorkflowsDb } from "./ports";
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
  creator: null,
  definition,
  runs: [],
  ...overrides,
});

const findMany = vi.fn<WorkflowDelegate["findMany"]>();
const findUnique = vi.fn<WorkflowDelegate["findUnique"]>();
const create = vi.fn<WorkflowDelegate["create"]>();
const update = vi.fn<WorkflowDelegate["update"]>();
const deleteFn = vi.fn<WorkflowDelegate["delete"]>();
const updateMany = vi.fn<WorkflowDelegate["updateMany"]>();
const versionFindFirst = vi.fn<WorkflowVersionDelegate["findFirst"]>();
const versionCreate = vi.fn<WorkflowVersionDelegate["create"]>();
const workflow = { findMany, findUnique, create, update, delete: deleteFn, updateMany };
const workflowVersion = { findFirst: versionFindFirst, create: versionCreate };
const prisma: WorkflowsDb = {
  workflow,
  workflowVersion,
  $transaction: (fn) => fn({ workflow, workflowVersion }),
};
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
    expect(createArgs.include).toEqual({
      runs: { take: 1, orderBy: { createdAt: "desc" } },
      creator: { select: { name: true } },
    });
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
      include: { runs: { take: 1, orderBy: { createdAt: "desc" } }, creator: { select: { name: true } } },
    });
  });

  test("returns null when the workflow does not exist", async () => {
    findUnique.mockResolvedValue(null);
    expect(await service.getWorkflowById("missing")).toBeNull();
  });
});

describe("updateWorkflow", () => {
  test("updates only the provided fields by composite key", async () => {
    update.mockResolvedValue(makeRow({ name: "Renamed" }));

    await service.updateWorkflow(
      { workflowId: "cm9zr4t2b000208l8h2m1aq3c", workspaceId },
      { name: "Renamed" }
    );

    const args = update.mock.calls[0][0];
    expect(args.where).toEqual({
      id_workspaceId: { id: "cm9zr4t2b000208l8h2m1aq3c", workspaceId },
    });
    expect(args.data).toEqual({ name: "Renamed" });
  });

  test("passes through an explicit null description but omits absent fields", async () => {
    update.mockResolvedValue(makeRow());
    await service.updateWorkflow(
      { workflowId: "cm9zr4t2b000208l8h2m1aq3c", workspaceId },
      { description: null }
    );
    expect(update.mock.calls[0][0].data).toEqual({ description: null });
  });
});

describe("duplicateWorkflow", () => {
  test("clones into a new draft with a default copy name", async () => {
    create.mockResolvedValue(makeRow());
    await service.duplicateWorkflow(makeRow({ name: "Original" }), { createdBy: "user_1" });

    expect(create.mock.calls[0][0].data).toMatchObject({
      workspaceId,
      name: "Original (copy)",
      status: "draft",
      createdBy: "user_1",
    });
  });

  test("honors an explicit duplicate name", async () => {
    create.mockResolvedValue(makeRow());
    await service.duplicateWorkflow(makeRow({ name: "Original" }), { name: "Custom", createdBy: null });
    expect(create.mock.calls[0][0].data.name).toBe("Custom");
  });
});

describe("deleteWorkflow", () => {
  test("hard-deletes by composite key", async () => {
    deleteFn.mockResolvedValue({ id: "cm9zr4t2b000208l8h2m1aq3c" });
    await service.deleteWorkflow({ workflowId: "cm9zr4t2b000208l8h2m1aq3c", workspaceId });
    expect(deleteFn).toHaveBeenCalledWith({
      where: { id_workspaceId: { id: "cm9zr4t2b000208l8h2m1aq3c", workspaceId } },
    });
  });
});

describe("setStatus", () => {
  test("updates status by composite key", async () => {
    update.mockResolvedValue(makeRow({ status: "archived" }));
    await service.setStatus({ workflowId: "cm9zr4t2b000208l8h2m1aq3c", workspaceId }, "archived");
    const args = update.mock.calls[0][0];
    expect(args.where).toEqual({ id_workspaceId: { id: "cm9zr4t2b000208l8h2m1aq3c", workspaceId } });
    expect(args.data).toEqual({ status: "archived" });
  });
});

describe("enableWorkflow", () => {
  test("guards the transition then snapshots version max+1 in one transaction", async () => {
    updateMany.mockResolvedValue({ count: 1 });
    versionFindFirst.mockResolvedValue({ version: 3 });
    findUnique.mockResolvedValue(makeRow({ status: "enabled" }));

    const result = await service.enableWorkflow(
      { workflowId: "cm9zr4t2b000208l8h2m1aq3c", workspaceId },
      { definition, publishedBy: "cm9zr52kh000508l8e3q7bw9j" }
    );

    // The status guard runs inside the transaction, scoped to draft/disabled rows only.
    expect(updateMany.mock.calls[0][0]).toEqual({
      where: { id: "cm9zr4t2b000208l8h2m1aq3c", workspaceId, status: { in: ["draft", "disabled"] } },
      data: { status: "enabled" },
    });
    expect(versionCreate.mock.calls[0][0].data).toMatchObject({
      workflowId: "cm9zr4t2b000208l8h2m1aq3c",
      workspaceId,
      version: 4,
      publishedBy: "cm9zr52kh000508l8e3q7bw9j",
    });
    expect(result.status).toBe("enabled");
  });

  test("uses version 1 when no prior version exists and stores null publishedBy", async () => {
    updateMany.mockResolvedValue({ count: 1 });
    versionFindFirst.mockResolvedValue(null);
    findUnique.mockResolvedValue(makeRow({ status: "enabled" }));

    await service.enableWorkflow(
      { workflowId: "cm9zr4t2b000208l8h2m1aq3c", workspaceId },
      { definition, publishedBy: null }
    );

    expect(versionCreate.mock.calls[0][0].data.version).toBe(1);
    expect(versionCreate.mock.calls[0][0].data.publishedBy).toBeNull();
  });

  test("rejects with a conflict (and writes no version) when the guard matches no row", async () => {
    updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.enableWorkflow(
        { workflowId: "cm9zr4t2b000208l8h2m1aq3c", workspaceId },
        { definition, publishedBy: null }
      )
    ).rejects.toBeInstanceOf(WorkflowConflictError);
    expect(versionCreate).not.toHaveBeenCalled();
  });

  test("maps a simultaneous-enable unique violation (P2002) to a conflict error", async () => {
    updateMany.mockResolvedValue({ count: 1 });
    versionFindFirst.mockResolvedValue({ version: 1 });
    versionCreate.mockRejectedValue(Object.assign(new Error("Unique constraint failed"), { code: "P2002" }));

    await expect(
      service.enableWorkflow(
        { workflowId: "cm9zr4t2b000208l8h2m1aq3c", workspaceId },
        { definition, publishedBy: null }
      )
    ).rejects.toBeInstanceOf(WorkflowConflictError);
  });

  test("rethrows non-unique transaction errors unchanged", async () => {
    updateMany.mockResolvedValue({ count: 1 });
    const boom = new Error("connection reset");
    versionFindFirst.mockRejectedValue(boom);

    await expect(
      service.enableWorkflow(
        { workflowId: "cm9zr4t2b000208l8h2m1aq3c", workspaceId },
        { definition, publishedBy: null }
      )
    ).rejects.toBe(boom);
  });
});

describe("disableWorkflow", () => {
  test("sets status to disabled by composite key", async () => {
    update.mockResolvedValue(makeRow({ status: "disabled" }));
    await service.disableWorkflow({ workflowId: "cm9zr4t2b000208l8h2m1aq3c", workspaceId });
    const args = update.mock.calls[0][0];
    expect(args.where).toEqual({ id_workspaceId: { id: "cm9zr4t2b000208l8h2m1aq3c", workspaceId } });
    expect(args.data).toEqual({ status: "disabled" });
  });
});
