import "server-only";
import { prisma } from "@formbricks/database";
import type { TWorkflowDefinition, TWorkflowListItem, TWorkflowResource } from "@formbricks/workflows";

const baseSelect = {
  id: true,
  workspaceId: true,
  name: true,
  description: true,
  status: true,
  createdBy: true,
  createdAt: true,
  updatedAt: true,
  definition: true,
} as const;

type WorkflowRow = {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  status: "draft" | "enabled" | "disabled" | "archived";
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  definition: TWorkflowDefinition;
};

const toListItem = (row: WorkflowRow): TWorkflowListItem => ({
  id: row.id,
  workspaceId: row.workspaceId,
  name: row.name,
  description: row.description,
  status: row.status,
  triggerType: row.definition.trigger.triggerType,
  surveyId: row.definition.trigger.config.surveyId,
  createdBy: row.createdBy,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
  lastRun: null,
});

const toResource = (row: WorkflowRow): TWorkflowResource => ({
  ...toListItem(row),
  definition: row.definition,
});

export async function loadWorkflowResource(workflowId: string): Promise<TWorkflowResource | null> {
  const row = await prisma.workflow.findUnique({ where: { id: workflowId }, select: baseSelect });
  return row ? toResource(row as WorkflowRow) : null;
}

export async function loadWorkspaceWorkflowList(workspaceId: string): Promise<TWorkflowListItem[]> {
  const rows = await prisma.workflow.findMany({
    where: { workspaceId },
    orderBy: { updatedAt: "desc" },
    select: baseSelect,
  });
  return rows.map((row) => toListItem(row as WorkflowRow));
}
