import "server-only";
import { prisma } from "@formbricks/database";
import { ZSurveyEndings } from "@formbricks/types/surveys/types";
import type { TWorkflowDefinition, TWorkflowListItem, TWorkflowResource } from "@formbricks/workflows";
import type { TWorkflowSurveyChoice } from "@/modules/workflows/types";

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

const endingDisplayLabel = (ending: { id: string } & Record<string, unknown>): string => {
  if (ending.type === "endScreen") {
    const headline = ending.headline as { default?: string } | undefined;
    const text = headline?.default?.trim();
    if (text) return text;
  } else if (ending.type === "redirectToUrl") {
    const label = (ending.label as string | undefined)?.trim();
    if (label) return label;
  }
  return ending.id;
};

export async function loadWorkspaceSurveyChoices(workspaceId: string): Promise<TWorkflowSurveyChoice[]> {
  const surveys = await prisma.survey.findMany({
    where: { workspaceId },
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true, endings: true },
  });

  return surveys.map((survey) => {
    const parsed = ZSurveyEndings.safeParse(survey.endings);
    const endings = parsed.success
      ? parsed.data.map((ending) => ({ id: ending.id, label: endingDisplayLabel(ending) }))
      : [];
    return { id: survey.id, name: survey.name, endings };
  });
}
