import useSWR from "swr";
import { fetcher } from "./utils";

export const usePipeline = (formId: string, pipelineId: string) => {
  const { data, error, mutate } = useSWR(() => `/api/forms/${formId}/pipelines/${pipelineId}`, fetcher);

  return {
    pipeline: data,
    isLoadingPipeline: !error && !data,
    isErrorPipeline: error,
    mutatePipeline: mutate,
  };
};

export const usePipelines = (formId: string) => {
  const { data, error, mutate } = useSWR(() => `/api/forms/${formId}/pipelines`, fetcher);

  return {
    pipelines: data,
    isLoadingPipelines: !error && !data,
    isErrorPipelines: error,
    mutatePipelines: mutate,
  };
};

export const persistPipeline = async (pipeline) => {
  try {
    await fetch(`/api/forms/${pipeline.formId}/pipelines/${pipeline.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(pipeline),
    });
  } catch (error) {
    console.error(error);
  }
};

export const createPipeline = async (formId, pipeline) => {
  try {
    const res = await fetch(`/api/forms/${formId}/pipelines`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(pipeline),
    });
    return await res.json();
  } catch (error) {
    console.error(error);
    throw Error(`create Pipeline: unable to create pipeline: ${error.message}`);
  }
};

export const deletePipeline = async (formId, pipelineId) => {
  try {
    const res = await fetch(`/api/forms/${formId}/pipelines/${pipelineId}`, {
      method: "DELETE",
    });
    return await res.json();
  } catch (error) {
    console.error(error);
    throw Error(`delete Pipeline: unable to delete pipeline: ${error.message}`);
  }
};
