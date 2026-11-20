import { z } from "zod";
import { ZId } from "@formbricks/types/common";

export const ZSurveyExampleResponsesParams = z.object({ surveyId: ZId }).strict();
