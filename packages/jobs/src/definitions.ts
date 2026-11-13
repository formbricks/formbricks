import { ATTACHMENT_EXPORT_QUEUE_NAME, JOB_NAMES } from "@/src/constants";
import { type AnyBackgroundJobDefinition, toAnyBackgroundJobDefinition } from "@/src/contracts";
import { processAttachmentExportJob } from "@/src/processors/attachment-export";
import { processResponsePipelineJob } from "@/src/processors/response-pipeline";
import { processTestLogJob } from "@/src/processors/test-log";
import { processWebhookDeliveryJob } from "@/src/processors/webhook-delivery";
import { processWorkflowHttpRequestDeliveryJob } from "@/src/processors/workflow-http-request-delivery";
import { processWorkflowRunJob } from "@/src/processors/workflow-run";
import { recurringJobDefinitions } from "@/src/recurring";
import {
  ZAttachmentExportJobData,
  ZResponsePipelineJobData,
  ZTestLogJobData,
  ZWebhookDeliveryJobData,
  ZWorkflowHttpRequestDeliveryJobData,
  ZWorkflowRunJobData,
} from "@/src/types";

/**
 * Every job the worker can process. The recurring jobs come from their declarations in `recurring.ts`,
 * so a new one is registered here and with the producer from a single place; the rest are one-shot jobs
 * enqueued per event.
 */
export const backgroundJobDefinitions: Record<string, AnyBackgroundJobDefinition> = {
  ...recurringJobDefinitions,
  [JOB_NAMES.attachmentExport]: toAnyBackgroundJobDefinition({
    handle: processAttachmentExportJob,
    name: JOB_NAMES.attachmentExport,
    queueName: ATTACHMENT_EXPORT_QUEUE_NAME,
    schema: ZAttachmentExportJobData,
  }),
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
  [JOB_NAMES.webhookDelivery]: toAnyBackgroundJobDefinition({
    handle: processWebhookDeliveryJob,
    name: JOB_NAMES.webhookDelivery,
    schema: ZWebhookDeliveryJobData,
  }),
  [JOB_NAMES.workflowRun]: toAnyBackgroundJobDefinition({
    handle: processWorkflowRunJob,
    name: JOB_NAMES.workflowRun,
    schema: ZWorkflowRunJobData,
  }),
  [JOB_NAMES.workflowHttpRequestDelivery]: toAnyBackgroundJobDefinition({
    handle: processWorkflowHttpRequestDeliveryJob,
    name: JOB_NAMES.workflowHttpRequestDelivery,
    schema: ZWorkflowHttpRequestDeliveryJobData,
  }),
};

export const getBackgroundJobDefinition = (jobName: string): AnyBackgroundJobDefinition | undefined =>
  backgroundJobDefinitions[jobName];
