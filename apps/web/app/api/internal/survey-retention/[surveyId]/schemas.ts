import { z } from "zod";

/** `GET /api/internal/survey-retention/{surveyId}` path. */
export const ZSurveyRetentionPathParams = z.object({ surveyId: z.cuid2() }).strict();
