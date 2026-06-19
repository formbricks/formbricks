import "server-only";
import { prisma } from "@formbricks/database";
import { ZSurveyEndings } from "@formbricks/types/surveys/types";
import { getTextContent } from "@formbricks/types/surveys/validation";
import type { TWorkflowDefinition, TWorkflowResource } from "@formbricks/workflows";
import type { TWorkflowSurveyChoice } from "@/modules/workflows/types";

// The list view is fetched client-side via TanStack Query (see modules/workflows/list/hooks/
// use-workflows.ts); the helpers below are server-only fetches used by the workflow detail
// shell (single workflow + survey-choices atom hydration).

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

const toResource = (row: WorkflowRow): TWorkflowResource => ({
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
  definition: row.definition,
});

export async function loadWorkflowResource(workflowId: string): Promise<TWorkflowResource | null> {
  const row = await prisma.workflow.findUnique({ where: { id: workflowId }, select: baseSelect });
  return row ? toResource(row) : null;
}

// Headline cards store the editor's rich-text HTML in the i18n `default` slot. The trigger
// dropdown renders these as plain text, so delegate the strip to the shared `getTextContent`
// helper (uses node-html-parser, no super-linear regex fallbacks).
const endingDisplayLabel = (ending: { id: string } & Record<string, unknown>): string => {
  if (ending.type === "endScreen") {
    const headline = ending.headline as { default?: string } | undefined;
    const text = getTextContent(headline?.default ?? "");
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
