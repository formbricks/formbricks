import { z } from "zod";
import { ZResponse } from "./responses";

export const ZPipelineTrigger = z.enum(["responseFinished", "responseCreated", "responseUpdated"]);

export type TPipelineTrigger = z.infer<typeof ZPipelineTrigger>;

export const ZPipelineInput = z.object({
  event: ZPipelineTrigger,
  response: ZResponse,
  environmentId: z.string(),
  surveyId: z.string(),
});

export type TPipelineInput = z.infer<typeof ZPipelineInput>;
