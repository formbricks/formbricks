import useSWR from "swr";

import { fetcher } from "./utils";

export const usePipelines = (formId: string, organisationId: string) => {
  const { data, error, mutate } = useSWR(
    `/api/organisations/${organisationId}/forms/${formId}/pipelines`,
    fetcher
  );

  return {
    pipelines: data,
    isLoadingPipelines: !error && !data,
    isErrorPipelines: error,
    mutatePipelines: mutate,
  };
};

export const usePipeline = (organisationId: string, formId: string, pipelineId: string) => {
  const { data, error, mutate } = useSWR(
    `/api/organisations/${organisationId}/forms/${formId}/pipelines/${pipelineId}`,
    fetcher
  );

  return {
    pipeline: data,
    isLoadingPipeline: !error && !data,
    isErrorPipeline: error,
    mutatePipeline: mutate,
  };
};

export const persistPipeline = async (formId, organisationId, pipeline) => {
  try {
    await fetch(`/api/organisations/${organisationId}/forms/${formId}/pipelines/${pipeline.id}/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(pipeline),
    });
  } catch (error) {
    console.error(error);
  }
};

export const createPipeline = async (formId: string, organisationId: string, pipeline = {}) => {
  try {
    const res = await fetch(`/api/organisations/${organisationId}/forms/${formId}/pipelines`, {
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

export const deletePipeline = async (formId: string, organisationId: string, pipelineId: string) => {
  try {
    await fetch(`/api/organisations/${organisationId}/forms/${formId}/pipelines/${pipelineId}`, {
      method: "DELETE",
    });
  } catch (error) {
    console.error(error);
    throw Error(`deletePipeline: unable to delete pipeline: ${error.message}`);
  }
};
