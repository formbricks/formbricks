import useSWR from "swr";

import { fetcher } from "./utils";

export const usePipelines = (formId: string, workspaceId: string) => {
  const { data, error, mutate } = useSWR(`/api/workspaces/${workspaceId}/forms/${formId}/pipelines`, fetcher);

  return {
    pipelines: data,
    isLoadingPipelines: !error && !data,
    isErrorPipelines: error,
    mutatePipelines: mutate,
  };
};

export const usePipeline = (workspaceId: string, formId: string, pipelineId: string) => {
  const { data, error, mutate } = useSWR(
    `/api/workspaces/${workspaceId}/forms/${formId}/pipelines/${pipelineId}`,
    fetcher
  );

  return {
    pipeline: data,
    isLoadingPipeline: !error && !data,
    isErrorPipeline: error,
    mutatePipeline: mutate,
  };
};

export const persistPipeline = async (formId, workspaceId, pipeline) => {
  try {
    await fetch(`/api/workspaces/${workspaceId}/forms/${formId}/pipelines/${pipeline.id}/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(pipeline),
    });
  } catch (error) {
    console.error(error);
  }
};

export const createPipeline = async (formId: string, workspaceId: string, pipeline = {}) => {
  try {
    const res = await fetch(`/api/workspaces/${workspaceId}/forms/${formId}/pipelines`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(pipeline),
    });
    return await res.json();
  } catch (error) {
    console.error(error);
    throw Error(`createPipeline: unable to create pipeline: ${error.message}`);
  }
};

export const deletePipeline = async (formId: string, workspaceId: string, pipelineId: string) => {
  try {
    await fetch(`/api/workspaces/${workspaceId}/forms/${formId}/pipelines/${pipelineId}`, {
      method: "DELETE",
    });
  } catch (error) {
    console.error(error);
    throw Error(`deletePipeline: unable to delete pipeline: ${error.message}`);
  }
};
