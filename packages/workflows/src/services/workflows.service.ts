import type { TCreateWorkflowInput, TListWorkflowsInput, TWorkflowSortBy } from "../contracts";
import { WorkflowConflictError } from "../errors";
import {
  type TWorkflowListCursor,
  buildNextWorkflowListCursor,
  decodeWorkflowListCursor,
  encodeWorkflowListCursor,
} from "../handlers/cursor";
import type { TWorkflowStatus } from "../types/common";
import type { TWorkflowDefinition, TWorkflowExecutableDefinition } from "../types/document";
import type {
  LastRunInclude,
  WorkflowDelegate,
  WorkflowOrderByInput,
  WorkflowRowWithLastRun,
  WorkflowWhereInput,
  WorkflowsDb,
} from "./ports";

/** Identifies one workflow within its workspace, for composite-key (`id`, `workspaceId`) scoping. */
export interface WorkflowScopedParams {
  workflowId: string;
  workspaceId: string;
}

/** Fields a patch may persist. `status` is changed only through the lifecycle methods, never here. */
export interface WorkflowUpdateInput {
  name?: string;
  description?: string | null;
  definition?: TWorkflowDefinition;
}

/** Eagerly load the most recent run so the serializer can emit `lastRun` without an N+1. */
const LAST_RUN_INCLUDE: LastRunInclude = {
  runs: { take: 1, orderBy: { createdAt: "desc" } },
};

/** Every field a workflow update may set; mirrors the injected delegate's `update` data shape. */
type WorkflowUpdateData = Parameters<WorkflowDelegate["update"]>[0]["data"];

/**
 * Single place that issues a workspace-scoped `workflow.update` with the standard last-run include.
 * The delegate is passed explicitly so it serves both the base client and an interactive transaction.
 */
const updateWorkflowRow = (
  workflow: WorkflowDelegate,
  { workflowId, workspaceId }: WorkflowScopedParams,
  data: WorkflowUpdateData
): Promise<WorkflowRowWithLastRun> =>
  workflow.update({
    where: { id_workspaceId: { id: workflowId, workspaceId } },
    data,
    include: LAST_RUN_INCLUDE,
  });

// Prisma's unique-constraint violation code, mirroring `PrismaErrorType.UniqueConstraintViolation`
// in `@formbricks/database` — which this leaf package can't import without recreating a build cycle.
const PRISMA_UNIQUE_CONSTRAINT_VIOLATION = "P2002";

/** Duck-typed P2002 detection — keeps the package free of a `@prisma/client` dependency. */
const isUniqueConstraintError = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  (error as { code?: unknown }).code === PRISMA_UNIQUE_CONSTRAINT_VIOLATION;

const getOrderBy = (sortBy: TWorkflowSortBy): WorkflowOrderByInput[] => {
  switch (sortBy) {
    case "name":
      return [{ name: "asc" }, { id: "asc" }];
    case "createdAt":
      return [{ createdAt: "desc" }, { id: "desc" }];
    case "updatedAt":
    default:
      return [{ updatedAt: "desc" }, { id: "desc" }];
  }
};

const buildCursorWhere = (cursor: TWorkflowListCursor): WorkflowWhereInput => {
  if (cursor.sortBy === "name") {
    return {
      OR: [{ name: { gt: cursor.value } }, { name: cursor.value, id: { gt: cursor.id } }],
    };
  }

  // createdAt / updatedAt sort descending → page towards older rows.
  const value = new Date(cursor.value);
  if (cursor.sortBy === "createdAt") {
    return { OR: [{ createdAt: { lt: value } }, { createdAt: value, id: { lt: cursor.id } }] };
  }
  return { OR: [{ updatedAt: { lt: value } }, { updatedAt: value, id: { lt: cursor.id } }] };
};

const buildListWhere = (
  input: TListWorkflowsInput,
  cursor: TWorkflowListCursor | null
): WorkflowWhereInput => ({
  workspaceId: input.workspaceId,
  // Default-exclude archived workflows unless the caller explicitly filters on status.
  ...(input.statusIn ? { status: { in: input.statusIn } } : { status: { not: "archived" } }),
  ...(input.nameContains ? { name: { contains: input.nameContains, mode: "insensitive" } } : {}),
  ...(cursor ? buildCursorWhere(cursor) : {}),
});

export interface WorkflowListPage {
  workflows: WorkflowRowWithLastRun[];
  nextCursor: string | null;
}

export interface WorkflowsService {
  listWorkflows: (input: TListWorkflowsInput) => Promise<WorkflowListPage>;
  createWorkflow: (
    input: TCreateWorkflowInput,
    options: { createdBy: string | null }
  ) => Promise<WorkflowRowWithLastRun>;
  getWorkflowById: (workflowId: string) => Promise<WorkflowRowWithLastRun | null>;
  updateWorkflow: (
    params: WorkflowScopedParams,
    data: WorkflowUpdateInput
  ) => Promise<WorkflowRowWithLastRun>;
  duplicateWorkflow: (
    source: WorkflowRowWithLastRun,
    options: { name?: string; createdBy: string | null }
  ) => Promise<WorkflowRowWithLastRun>;
  deleteWorkflow: (params: WorkflowScopedParams) => Promise<void>;
  setStatus: (params: WorkflowScopedParams, status: TWorkflowStatus) => Promise<WorkflowRowWithLastRun>;
  enableWorkflow: (
    params: WorkflowScopedParams,
    options: { definition: TWorkflowExecutableDefinition; publishedBy: string | null }
  ) => Promise<WorkflowRowWithLastRun>;
  disableWorkflow: (params: WorkflowScopedParams) => Promise<WorkflowRowWithLastRun>;
}

/**
 * Data-access layer for the v3 Workflows API. Prisma is injected (see `ports.ts`) so the package
 * carries no runtime dependency on `@formbricks/database`. Inputs are already validated by the
 * contract schemas at the handler boundary, so the service does not re-parse them. DB errors are
 * allowed to bubble to the handler's error mapper (logged there once, as a 500).
 */
export const createWorkflowsService = ({ prisma }: { prisma: WorkflowsDb }): WorkflowsService => ({
  async listWorkflows(input) {
    const cursor = input.cursor ? decodeWorkflowListCursor(input.cursor, input.sortBy) : null;

    const rows = await prisma.workflow.findMany({
      where: buildListWhere(input, cursor),
      orderBy: getOrderBy(input.sortBy),
      take: input.limit + 1,
      include: LAST_RUN_INCLUDE,
    });

    const hasMore = rows.length > input.limit;
    const workflows = hasMore ? rows.slice(0, input.limit) : rows;
    const lastRow = workflows.at(-1);

    return {
      workflows,
      nextCursor:
        hasMore && lastRow
          ? encodeWorkflowListCursor(buildNextWorkflowListCursor(lastRow, input.sortBy))
          : null,
    };
  },

  async createWorkflow(input, { createdBy }) {
    return prisma.workflow.create({
      data: {
        workspaceId: input.workspaceId,
        name: input.name,
        description: input.description ?? null,
        status: "draft",
        definition: input.definition,
        createdBy,
      },
      include: LAST_RUN_INCLUDE,
    });
  },

  async getWorkflowById(workflowId) {
    return prisma.workflow.findUnique({
      where: { id: workflowId },
      include: LAST_RUN_INCLUDE,
    });
  },

  async updateWorkflow({ workflowId, workspaceId }, data) {
    return updateWorkflowRow(
      prisma.workflow,
      { workflowId, workspaceId },
      {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.definition !== undefined ? { definition: data.definition } : {}),
      }
    );
  },

  async duplicateWorkflow(source, { name, createdBy }) {
    return prisma.workflow.create({
      data: {
        workspaceId: source.workspaceId,
        name: name ?? `${source.name} (copy)`,
        description: source.description,
        status: "draft",
        definition: source.definition,
        createdBy,
      },
      include: LAST_RUN_INCLUDE,
    });
  },

  async deleteWorkflow({ workflowId, workspaceId }) {
    // Hard delete; Prisma `onDelete: Cascade` removes the workflow's runs + run logs (GDPR).
    await prisma.workflow.delete({ where: { id_workspaceId: { id: workflowId, workspaceId } } });
  },

  async setStatus({ workflowId, workspaceId }, status) {
    return updateWorkflowRow(prisma.workflow, { workflowId, workspaceId }, { status });
  },

  async enableWorkflow({ workflowId, workspaceId }, { definition, publishedBy }) {
    // Atomic: snapshot an immutable version (version = max + 1) and flip status in one transaction,
    // so an enabled workflow always has a live version to run against. The executable `definition`
    // is validated by the handler; the service trusts it.
    try {
      return await prisma.$transaction(async (tx) => {
        const latest = await tx.workflowVersion.findFirst({
          where: { workflowId },
          orderBy: { version: "desc" },
          select: { version: true },
        });

        await tx.workflowVersion.create({
          data: { workflowId, workspaceId, version: (latest?.version ?? 0) + 1, definition, publishedBy },
        });

        return updateWorkflowRow(tx.workflow, { workflowId, workspaceId }, { status: "enabled" });
      });
    } catch (error) {
      // Concurrent enable: two requests read the same max version and both insert version+1; the
      // loser violates @@unique([workflowId, version]). The transaction has already rolled back
      // cleanly, so surface a retryable 409 instead of a generic 500.
      if (isUniqueConstraintError(error)) {
        throw new WorkflowConflictError("The workflow was just enabled by another request. Please retry.");
      }
      throw error;
    }
  },

  async disableWorkflow({ workflowId, workspaceId }) {
    return updateWorkflowRow(prisma.workflow, { workflowId, workspaceId }, { status: "disabled" });
  },
});
