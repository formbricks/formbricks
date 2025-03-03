import { PipelineTriggers } from "@prisma/client";
import { TResponse } from "@formbricks/types/responses";

export interface TPipelineInput {
  event: PipelineTriggers;
  response: TResponse;
  environmentId: string;
  surveyId: string;
}
