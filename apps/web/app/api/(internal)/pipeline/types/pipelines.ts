import { z } from "zod";
import { ZWebhook } from "@formbricks/database/zod/webhooks";
import { ZResponse } from "@formbricks/types/responses";

export const ZPipelineInput = z.object({
  event: ZWebhook.shape.triggers.element,
  response: ZResponse,
  environmentId: z.string(),
  surveyId: z.string(),
});

export type TPipelineInput = z.infer<typeof ZPipelineInput>;
