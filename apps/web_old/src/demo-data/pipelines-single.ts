import { getData as getPipelines } from "./pipelines";

export const getData = (endpointUrl) => {
  const id = endpointUrl.split("/").pop();
  const pipelines = getPipelines();
  return pipelines.find((pipeline) => pipeline.id === id);
};
