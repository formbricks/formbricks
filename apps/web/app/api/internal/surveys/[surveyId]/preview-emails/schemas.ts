import { z } from "zod";
import { ZId } from "@formbricks/types/common";

export const ZSurveyPreviewEmailParams = z.object({ surveyId: ZId }).strict();
