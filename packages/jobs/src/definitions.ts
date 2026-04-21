import { JOB_NAMES } from "@/src/constants";
import { type AnyBackgroundJobDefinition, toAnyBackgroundJobDefinition } from "@/src/contracts";
import { processAITranslationJob } from "@/src/processors/ai-translation";
import { processResponsePipelineJob } from "@/src/processors/response-pipeline";
import { processTestLogJob } from "@/src/processors/test-log";
import { ZAITranslationJobData, ZResponsePipelineJobData, ZTestLogJobData } from "@/src/types";

export const backgroundJobDefinitions = {
  [JOB_NAMES.responsePipeline]: toAnyBackgroundJobDefinition({
    handle: processResponsePipelineJob,
    name: JOB_NAMES.responsePipeline,
    schema: ZResponsePipelineJobData,
  }),
  [JOB_NAMES.testLog]: toAnyBackgroundJobDefinition({
    handle: processTestLogJob,
    name: JOB_NAMES.testLog,
    schema: ZTestLogJobData,
  }),
  [JOB_NAMES.aiTranslation]: toAnyBackgroundJobDefinition({
    handle: processAITranslationJob,
    name: JOB_NAMES.aiTranslation,
    schema: ZAITranslationJobData,
  }),
} as const satisfies Record<string, AnyBackgroundJobDefinition>;

export type TBackgroundJobName = keyof typeof backgroundJobDefinitions;

export const getBackgroundJobDefinition = (jobName: string): AnyBackgroundJobDefinition | undefined =>
  backgroundJobDefinitions[jobName as TBackgroundJobName];
