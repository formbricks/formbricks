import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { ZResponseFilterCriteriaJson } from "@/lib/response/filter-criteria-json";

export const ZSurveySummaryParams = z.object({ surveyId: ZId }).strict();

/** `POST /api/internal/surveys/{surveyId}/summary/queries` body: the responses the summary is over. */
export const ZSurveySummaryQueryBody = z
  .object({ filterCriteria: ZResponseFilterCriteriaJson.optional() })
  .strict();
