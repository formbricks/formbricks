import { z } from "zod";
import { ZWebhook } from "@formbricks/database/zod/webhooks";
import { ZResponse } from "@formbricks/types/responses";

export const ZTestLogJobData = z.object({
  message: z.string().min(1),
  shouldFail: z.boolean().optional(),
  context: z.record(z.string(), z.unknown()).optional(),
});

export type TTestLogJobData = z.infer<typeof ZTestLogJobData>;

export const ZResponsePipelineJobData = z.object({
  event: ZWebhook.shape.triggers.element,
  response: ZResponse,
  environmentId: z.string().min(1),
  surveyId: z.string().min(1),
});

export type TResponsePipelineJobData = z.infer<typeof ZResponsePipelineJobData>;
