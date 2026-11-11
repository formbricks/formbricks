import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { ZResponseFilterCriteriaBody } from "@/app/api/internal/lib/response-filter-criteria";

export const ZSurveySummaryParams = z.object({ surveyId: ZId }).strict();

/** `POST /api/internal/surveys/{surveyId}/summary/queries` body: the responses the summary is over. */
export const ZSurveySummaryQueryBody = z
  .object({ filterCriteria: ZResponseFilterCriteriaBody.optional() })
  .strict();
