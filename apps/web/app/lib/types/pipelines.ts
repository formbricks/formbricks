import { PipelineTriggers } from "@formbricks/database/generated/client";
import { TResponse } from "@formbricks/types/responses";

export interface TPipelineInput {
  event: PipelineTriggers;
  response: TResponse;
  environmentId: string;
  surveyId: string;
}
