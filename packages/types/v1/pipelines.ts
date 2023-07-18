import { z } from "zod";

export const ZPipelineTrigger = z.enum(["responseFinished", "responseCreated", "responseUpdated"]);

export type TPipelineTrigger = z.infer<typeof ZPipelineTrigger>;

export const ZPipelineInput = z.object({
  event: ZPipelineTrigger,
  data: z.unknown(),
  internalSecret: z.string(),
  environmentId: z.string(),
  surveyId: z.string(),
});

export type TPipelineInput = z.infer<typeof ZPipelineInput>;
