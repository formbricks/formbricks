import "server-only";
import type { JobHandler, TWorkflowRunJobData } from "@formbricks/jobs";
import { processWorkflowRun } from "./service";

export const processWorkflowRunJob: JobHandler<TWorkflowRunJobData> = async (data) => {
  await processWorkflowRun(data);
};
