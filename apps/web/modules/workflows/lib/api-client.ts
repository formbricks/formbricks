"use client";

import type { TWorkflowDefinition, TWorkflowRunStatus, TWorkflowStatus } from "@formbricks/types/workflows";
import { parseV3ApiError } from "@/modules/api/lib/v3-client";
import type { TWorkflow, TWorkflowRun } from "../types/workflows";

type TListResponse<T> = {
  data: T[];
  meta: {
    limit: number;
    nextCursor: string | null;
  };
};

type TItemResponse<T> = {
  data: T;
};

const parseJsonResponse = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    throw await parseV3ApiError(response);
  }

  return (await response.json()) as T;
};

export const listWorkflows = async ({
  workspaceId,
  status,
}: {
  workspaceId: string;
  status?: TWorkflowStatus;
}): Promise<TListResponse<TWorkflow>> => {
  const params = new URLSearchParams({ workspaceId });
  if (status) {
    params.set("status", status);
  }

  const response = await fetch(`/api/v3/workflows?${params.toString()}`, {
    cache: "no-store",
  });
  return await parseJsonResponse<TListResponse<TWorkflow>>(response);
};

export const createWorkflow = async ({
  workspaceId,
  name,
  description,
  definition,
}: {
  workspaceId: string;
  name: string;
  description?: string | null;
  definition: TWorkflowDefinition;
}): Promise<TWorkflow> => {
  const response = await fetch("/api/v3/workflows", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ workspaceId, name, description, definition }),
  });
  const result = await parseJsonResponse<TItemResponse<TWorkflow>>(response);
  return result.data;
};

export const getWorkflow = async (workflowId: string): Promise<TWorkflow> => {
  const response = await fetch(`/api/v3/workflows/${workflowId}`, {
    cache: "no-store",
  });
  const result = await parseJsonResponse<TItemResponse<TWorkflow>>(response);
  return result.data;
};

export const updateWorkflow = async ({
  workflowId,
  name,
  description,
  definition,
}: {
  workflowId: string;
  name?: string;
  description?: string | null;
  definition?: TWorkflowDefinition;
}): Promise<TWorkflow> => {
  const response = await fetch(`/api/v3/workflows/${workflowId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name, description, definition }),
  });
  const result = await parseJsonResponse<TItemResponse<TWorkflow>>(response);
  return result.data;
};

export const deleteWorkflow = async (workflowId: string): Promise<{ id: string }> => {
  const response = await fetch(`/api/v3/workflows/${workflowId}`, {
    method: "DELETE",
  });
  const result = await parseJsonResponse<TItemResponse<{ id: string }>>(response);
  return result.data;
};

export const enableWorkflow = async (workflowId: string): Promise<TWorkflow> => {
  const response = await fetch(`/api/v3/workflows/${workflowId}/enable`, {
    method: "POST",
  });
  const result = await parseJsonResponse<TItemResponse<TWorkflow>>(response);
  return result.data;
};

export const disableWorkflow = async (workflowId: string): Promise<TWorkflow> => {
  const response = await fetch(`/api/v3/workflows/${workflowId}/disable`, {
    method: "POST",
  });
  const result = await parseJsonResponse<TItemResponse<TWorkflow>>(response);
  return result.data;
};

export const listWorkflowRuns = async ({
  workflowId,
  status,
}: {
  workflowId: string;
  status?: TWorkflowRunStatus;
}): Promise<TListResponse<TWorkflowRun>> => {
  const params = new URLSearchParams();
  if (status) {
    params.set("status", status);
  }

  const response = await fetch(`/api/v3/workflows/${workflowId}/runs?${params.toString()}`, {
    cache: "no-store",
  });
  return await parseJsonResponse<TListResponse<TWorkflowRun>>(response);
};

export const listWorkspaceWorkflowRuns = async ({
  workspaceId,
  status,
}: {
  workspaceId: string;
  status?: TWorkflowRunStatus;
}): Promise<TListResponse<TWorkflowRun>> => {
  const params = new URLSearchParams({ workspaceId });
  if (status) {
    params.set("status", status);
  }

  const response = await fetch(`/api/v3/workflows/runs?${params.toString()}`, {
    cache: "no-store",
  });
  return await parseJsonResponse<TListResponse<TWorkflowRun>>(response);
};

export const getWorkflowRun = async (workflowId: string, runId: string): Promise<TWorkflowRun> => {
  const response = await fetch(`/api/v3/workflows/${workflowId}/runs/${runId}`, {
    cache: "no-store",
  });
  const result = await parseJsonResponse<TItemResponse<TWorkflowRun>>(response);
  return result.data;
};
