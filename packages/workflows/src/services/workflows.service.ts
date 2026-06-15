import type { TCreateWorkflowInput, TListWorkflowsInput, TWorkflowSortBy } from "../contracts";
import {
  type TWorkflowListCursor,
  buildNextWorkflowListCursor,
  decodeWorkflowListCursor,
  encodeWorkflowListCursor,
} from "../handlers/cursor";
import type {
  LastRunInclude,
  WorkflowOrderByInput,
  WorkflowRowWithLastRun,
  WorkflowWhereInput,
  WorkflowsDb,
} from "./ports";

/** Eagerly load the most recent run so the serializer can emit `lastRun` without an N+1. */
const LAST_RUN_INCLUDE: LastRunInclude = {
  runs: { take: 1, orderBy: { createdAt: "desc" } },
};

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
});
