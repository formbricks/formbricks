import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { ZResponseFilterCriteriaJson } from "@/lib/response/filter-criteria-json";

/**
 * Most responses one query may ask for. The Responses page asks for 25 at a time; this is the public
 * responses list's cap.
 */
export const SURVEY_RESPONSES_QUERY_MAX_LIMIT = 250;

/**
 * Furthest a query may page into a survey's responses: 40,000 of the Responses page's scroll pages, and
 * still an offset Postgres skips in well under a second.
 */
export const SURVEY_RESPONSES_QUERY_MAX_OFFSET = 1_000_000;

export const ZSurveyResponsesParams = z.object({ surveyId: ZId }).strict();

/**
 * `POST /api/internal/surveys/{surveyId}/responses/queries` body: one page of the survey's responses
 * matching the filter. Leaving `limit` out reads the service's page size, as the server action did.
 */
export const ZSurveyResponsesQueryBody = z
  .object({
    limit: z.int().min(1).max(SURVEY_RESPONSES_QUERY_MAX_LIMIT).optional(),
    offset: z.int().min(0).max(SURVEY_RESPONSES_QUERY_MAX_OFFSET).optional(),
    filterCriteria: ZResponseFilterCriteriaJson.optional(),
  })
  .strict();

/** `POST /api/internal/surveys/{surveyId}/responses/counts` body: how many of its responses match. */
export const ZSurveyResponseCountBody = z
  .object({ filterCriteria: ZResponseFilterCriteriaJson.optional() })
  .strict();
