import { JOB_NAMES } from "@/src/constants";
import { type AnyBackgroundJobDefinition, toAnyBackgroundJobDefinition } from "@/src/contracts";
import { processResponsePipelineJob } from "@/src/processors/response-pipeline";
import { processSurveySchedulingJob } from "@/src/processors/survey-scheduling";
import { processTestLogJob } from "@/src/processors/test-log";
import { processWorkflowRunJob } from "@/src/processors/workflow-run";
import {
  ZResponsePipelineJobData,
  ZSurveySchedulingJobData,
  ZTestLogJobData,
  ZWorkflowRunJobData,
} from "@/src/types";

export const backgroundJobDefinitions = {
  [JOB_NAMES.responsePipeline]: toAnyBackgroundJobDefinition({
    handle: processResponsePipelineJob,
    name: JOB_NAMES.responsePipeline,
    schema: ZResponsePipelineJobData,
  }),
  [JOB_NAMES.surveyScheduling]: toAnyBackgroundJobDefinition({
    handle: processSurveySchedulingJob,
    name: JOB_NAMES.surveyScheduling,
    schema: ZSurveySchedulingJobData,
  }),
  [JOB_NAMES.testLog]: toAnyBackgroundJobDefinition({
    handle: processTestLogJob,
    name: JOB_NAMES.testLog,
    schema: ZTestLogJobData,
  }),
  [JOB_NAMES.workflowRun]: toAnyBackgroundJobDefinition({
    handle: processWorkflowRunJob,
    name: JOB_NAMES.workflowRun,
    schema: ZWorkflowRunJobData,
  }),
} as const satisfies Record<string, AnyBackgroundJobDefinition>;

export type TBackgroundJobName = keyof typeof backgroundJobDefinitions;

export const getBackgroundJobDefinition = (jobName: string): AnyBackgroundJobDefinition | undefined =>
  backgroundJobDefinitions[jobName as TBackgroundJobName];
