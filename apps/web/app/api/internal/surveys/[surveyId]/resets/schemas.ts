import { z } from "zod";
import { ZId } from "@formbricks/types/common";

export const ZSurveyResetParams = z.object({ surveyId: ZId }).strict();
