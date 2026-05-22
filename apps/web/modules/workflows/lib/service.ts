import "server-only";
import { Prisma, type WorkflowRunStatus, type WorkflowStatus } from "@prisma/client";
import { prisma } from "@formbricks/database";
import { type TResponsePipelineJobData, enqueueWorkflowRunJob } from "@formbricks/jobs";
import { logger } from "@formbricks/logger";
import {
  type TWorkflowDefinition,
  type TWorkflowRunData,
  type TWorkflowStatus,
  type TWorkflowTriggerPayload,
  ZWorkflowDefinition,
  ZWorkflowRunData,
  ZWorkflowStatus,
  ZWorkflowTriggerPayload,
} from "@formbricks/types/workflows";
import { executeWorkflowDefinition } from "./executor";

const DEFAULT_PAGE_LIMIT = 20;
const MAX_PAGE_LIMIT = 100;
const RESPONSE_COMPLETED_TRIGGER_EVENT = "response.completed";

type TWorkflowListParams = {
  workspaceId: string;
  status?: TWorkflowStatus;
  limit?: number;
  cursor?: string;
};

type TWorkflowRunListParams = {
  workflowId: string;
  workspaceId: string;
  status?: WorkflowRunStatus;
  limit?: number;
  cursor?: string;
};

type TWorkspaceWorkflowRunListParams = Omit<TWorkflowRunListParams, "workflowId">;

const getPageLimit = (limit?: number): number =>
  Math.min(Math.max(limit ?? DEFAULT_PAGE_LIMIT, 1), MAX_PAGE_LIMIT);

const toJsonInput = (value: unknown): Prisma.InputJsonValue =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

const validateDefinition = (definition: unknown): TWorkflowDefinition =>
  ZWorkflowDefinition.parse(definition);

const parseRunData = (data: unknown): TWorkflowRunData => {
  const parsed = ZWorkflowRunData.safeParse(data);
  return parsed.success ? parsed.data : { steps: [], logs: [] };
};

export const listWorkflows = async ({ workspaceId, status, limit, cursor }: TWorkflowListParams) => {
  const take = getPageLimit(limit);
  const rows = await prisma.workflow.findMany({
    where: {
      workspaceId,
      ...(status ? { status: status as WorkflowStatus } : {}),
    },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: {
      runs: {
        orderBy: {
          createdAt: "desc",
        },
        take: 1,
      },
    },
  });

  const nextCursor = rows.length > take ? rows[take]?.id : null;
  return {
    workflows: rows.slice(0, take),
    nextCursor,
  };
};

export const getWorkflow = async (workflowId: string) => {
  return await prisma.workflow.findUnique({
    where: {
      id: workflowId,
    },
  });
};

export const getWorkflowByWorkspace = async (workflowId: string, workspaceId: string) => {
  return await prisma.workflow.findUnique({
    where: {
      id_workspaceId: {
        id: workflowId,
        workspaceId,
      },
    },
  });
};

export const createWorkflow = async ({
  workspaceId,
  name,
  description,
  definition,
  createdBy,
}: {
  workspaceId: string;
  name: string;
  description?: string | null;
  definition: unknown;
  createdBy?: string;
}) => {
  const parsedDefinition = validateDefinition(definition);

  return await prisma.workflow.create({
    data: {
      workspaceId,
      name,
      description,
      status: "draft",
      definition: toJsonInput(parsedDefinition),
      createdBy,
    },
  });
};

export const updateWorkflow = async ({
  workflowId,
  workspaceId,
  name,
  description,
  definition,
}: {
  workflowId: string;
  workspaceId: string;
  name?: string;
  description?: string | null;
  definition?: unknown;
}) => {
  const workflow = await getWorkflowByWorkspace(workflowId, workspaceId);
  if (!workflow) {
    return null;
  }

  if (workflow.status === "enabled") {
    throw new Error("Enabled workflows must be disabled before editing.");
  }

  const parsedDefinition = definition === undefined ? undefined : validateDefinition(definition);

  return await prisma.workflow.update({
    where: {
      id_workspaceId: {
        id: workflowId,
        workspaceId,
      },
    },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(parsedDefinition !== undefined ? { definition: toJsonInput(parsedDefinition) } : {}),
    },
  });
};

export const deleteWorkflow = async (workflowId: string, workspaceId: string) => {
  return await prisma.workflow.delete({
    where: {
      id_workspaceId: {
        id: workflowId,
        workspaceId,
      },
    },
    select: {
      id: true,
    },
  });
};

export const enableWorkflow = async (workflowId: string, workspaceId: string) => {
  const workflow = await getWorkflowByWorkspace(workflowId, workspaceId);
  if (!workflow) {
    return null;
  }

  if (workflow.status !== "draft" && workflow.status !== "disabled") {
    throw new Error("Only draft or disabled workflows can be enabled.");
  }

  validateDefinition(workflow.definition);

  return await prisma.workflow.update({
    where: {
      id_workspaceId: {
        id: workflowId,
        workspaceId,
      },
    },
    data: {
      status: "enabled",
    },
  });
};

export const disableWorkflow = async (workflowId: string, workspaceId: string) => {
  const workflow = await getWorkflowByWorkspace(workflowId, workspaceId);
  if (!workflow) {
    return null;
  }

  if (workflow.status !== "enabled") {
    throw new Error("Only enabled workflows can be disabled.");
  }

  return await prisma.workflow.update({
    where: {
      id_workspaceId: {
        id: workflowId,
        workspaceId,
      },
    },
    data: {
      status: "disabled",
    },
  });
};

export const listWorkflowRuns = async ({
  workflowId,
  workspaceId,
  status,
  limit,
  cursor,
}: TWorkflowRunListParams) => {
  const take = getPageLimit(limit);
  const rows = await prisma.workflowRun.findMany({
    where: {
      workflowId,
      workspaceId,
      ...(status ? { status } : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const nextCursor = rows.length > take ? rows[take]?.id : null;
  return {
    runs: rows.slice(0, take),
    nextCursor,
  };
};

export const listWorkspaceWorkflowRuns = async ({
  workspaceId,
  status,
  limit,
  cursor,
}: TWorkspaceWorkflowRunListParams) => {
  const take = getPageLimit(limit);
  const rows = await prisma.workflowRun.findMany({
    where: {
      workspaceId,
      ...(status ? { status } : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: {
      workflow: true,
    },
  });

  const nextCursor = rows.length > take ? rows[take]?.id : null;
  return {
    runs: rows.slice(0, take),
    nextCursor,
  };
};

export const getWorkflowRun = async (workflowId: string, workspaceId: string, runId: string) => {
  return await prisma.workflowRun.findFirst({
    where: {
      id: runId,
      workflowId,
      workspaceId,
    },
    include: {
      workflow: true,
    },
  });
};

export const enqueueResponseCompletedWorkflowRuns = async ({
  workspaceId,
  surveyId,
  response,
}: {
  workspaceId: string;
  surveyId: string;
  response: TResponsePipelineJobData["response"];
}) => {
  const triggerPayload: TWorkflowTriggerPayload = ZWorkflowTriggerPayload.parse({
    event: RESPONSE_COMPLETED_TRIGGER_EVENT,
    workspaceId,
    surveyId,
    response,
  });

  const workflows = await prisma.workflow.findMany({
    where: {
      workspaceId,
      status: "enabled",
    },
  });

  const matchingWorkflows = workflows.filter((workflow) => {
    const parsedDefinition = ZWorkflowDefinition.safeParse(workflow.definition);
    if (!parsedDefinition.success) {
      return false;
    }

    const trigger = parsedDefinition.data.trigger.config;
    return (
      trigger.type === RESPONSE_COMPLETED_TRIGGER_EVENT &&
      (!trigger.surveyId || trigger.surveyId === surveyId)
    );
  });

  const runs = [];
  for (const workflow of matchingWorkflows) {
    const run = await prisma.workflowRun.create({
      data: {
        workflowId: workflow.id,
        workspaceId,
        status: "queued",
        triggerEvent: RESPONSE_COMPLETED_TRIGGER_EVENT,
        surveyId,
        responseId: response.id,
        triggerPayload: toJsonInput(triggerPayload),
        data: toJsonInput({ triggerPayload, steps: [], logs: [] }),
      },
    });

    await enqueueWorkflowRunJob({
      workflowRunId: run.id,
      workflowId: workflow.id,
      workspaceId,
    });
    runs.push(run);
  }

  return runs;
};

export const enqueueResponseCompletedWorkflowRunsSafely = async ({
  workspaceId,
  surveyId,
  response,
  logContext,
}: {
  workspaceId: string;
  surveyId: string;
  response: TResponsePipelineJobData["response"];
  logContext?: Record<string, unknown>;
}): Promise<void> => {
  try {
    await enqueueResponseCompletedWorkflowRuns({ workspaceId, surveyId, response });
  } catch (error) {
    logger.error(
      {
        ...logContext,
        err: error,
      },
      "Response Completed workflow enqueue failed"
    );
  }
};

export const processWorkflowRun = async ({
  workflowRunId,
  workflowId,
  workspaceId,
}: {
  workflowRunId: string;
  workflowId: string;
  workspaceId: string;
}) => {
  const run = await prisma.workflowRun.findFirst({
    where: {
      id: workflowRunId,
      workflowId,
      workspaceId,
    },
    include: {
      workflow: true,
    },
  });

  if (!run) {
    throw new Error(`Workflow run ${workflowRunId} was not found`);
  }

  await prisma.workflowRun.updateMany({
    where: {
      id: workflowRunId,
      workflowId,
      workspaceId,
    },
    data: {
      status: "running",
      startedAt: new Date(),
      error: null,
    },
  });

  const result = executeWorkflowDefinition(run.workflow.definition, run.triggerPayload);
  const runData = parseRunData(run.data);
  const finishedAt = new Date();

  await prisma.workflowRun.updateMany({
    where: {
      id: workflowRunId,
      workflowId,
      workspaceId,
    },
    data: {
      status: result.status === "completed" ? "completed" : "failed",
      finishedAt,
      error: result.error,
      data: toJsonInput({
        ...runData,
        triggerPayload: run.triggerPayload,
        steps: result.steps,
        finalOutput: result.finalOutput,
      }),
    },
  });

  if (result.status === "failed") {
    throw new Error(result.error ?? `Workflow run ${workflowRunId} failed`);
  }
};

export const parseWorkflowStatus = (status: unknown): TWorkflowStatus | undefined => {
  if (status === undefined || status === null || status === "") {
    return undefined;
  }

  return ZWorkflowStatus.parse(status);
};
