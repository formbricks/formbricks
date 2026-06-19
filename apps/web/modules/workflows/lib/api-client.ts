import type { TPatchWorkflowInput, TWorkflowResource } from "@formbricks/workflows";
import { parseV3ApiError } from "@/modules/api/lib/v3-client";

const JSON_HEADERS = { "Content-Type": "application/json" };

async function readWorkflowResponse(response: Response): Promise<TWorkflowResource> {
  if (!response.ok) {
    throw await parseV3ApiError(response);
  }

  const body = (await response.json()) as { data: TWorkflowResource };
  return body.data;
}

export async function getWorkflow(workflowId: string, signal?: AbortSignal): Promise<TWorkflowResource> {
  const response = await fetch(`/api/v3/workflows/${workflowId}`, {
    method: "GET",
    cache: "no-store",
    signal,
  });

  return readWorkflowResponse(response);
}

export async function updateWorkflow(
  workflowId: string,
  payload: TPatchWorkflowInput
): Promise<TWorkflowResource> {
  const response = await fetch(`/api/v3/workflows/${workflowId}`, {
    method: "PATCH",
    cache: "no-store",
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
  });

  return readWorkflowResponse(response);
}

async function postLifecycle(workflowId: string, action: string): Promise<TWorkflowResource> {
  const response = await fetch(`/api/v3/workflows/${workflowId}/${action}`, {
    method: "POST",
    cache: "no-store",
  });

  return readWorkflowResponse(response);
}

export const enableWorkflow = (workflowId: string) => postLifecycle(workflowId, "enable");
export const disableWorkflow = (workflowId: string) => postLifecycle(workflowId, "disable");
export const archiveWorkflow = (workflowId: string) => postLifecycle(workflowId, "archive");
export const unarchiveWorkflow = (workflowId: string) => postLifecycle(workflowId, "unarchive");
