import { z } from "zod";
import { ZId } from "@formbricks/types/common";

export const ZSurveyEmailEmbedParams = z.object({ surveyId: ZId }).strict();
