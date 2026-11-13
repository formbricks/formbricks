import { z } from "zod";
import { ZId } from "@formbricks/types/common";

/** Most displays one page may ask for, as the server action allowed. The Summary page asks for 15. */
export const SURVEY_DISPLAYS_MAX_LIMIT = 100;

/**
 * Furthest a page may reach into a survey's displays: tens of thousands of the Impressions tab's "load
 * more" pages, and still an offset Postgres skips in well under a second.
 */
export const SURVEY_DISPLAYS_MAX_OFFSET = 1_000_000;

export const ZSurveyDisplaysParams = z.object({ surveyId: ZId }).strict();

/** `GET /api/internal/surveys/{surveyId}/displays?limit=&offset=` query: one page, newest first. */
export const ZSurveyDisplaysQuery = z
  .object({
    limit: z.coerce.number().int().min(1).max(SURVEY_DISPLAYS_MAX_LIMIT),
    offset: z.coerce.number().int().min(0).max(SURVEY_DISPLAYS_MAX_OFFSET),
  })
  .strict();
