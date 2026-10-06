import { z } from "zod";
import { ZSurveyVisibility } from "@formbricks/types/surveys/types";

/** `POST /api/v3/surveys/{surveyId}/visibility` body. Strict: any other key is a 400. */
export const ZV3SurveyVisibilityBody = z.object({ visibility: ZSurveyVisibility }).strict();

export type TV3SurveyVisibilityBody = z.infer<typeof ZV3SurveyVisibilityBody>;
