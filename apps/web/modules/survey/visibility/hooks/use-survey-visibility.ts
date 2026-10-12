"use client";

import { useQuery } from "@tanstack/react-query";
import { surveyKeys } from "@/modules/survey/list/lib/query";
import { getSurveyVisibility } from "@/modules/survey/list/lib/v3-surveys-client";

/** The visibility sub-resource: blockers, impact, pending change and the targets a change may pick. */
export const useSurveyVisibility = ({ surveyId, enabled = true }: { surveyId: string; enabled?: boolean }) =>
  useQuery({
    queryKey: surveyKeys.visibility(surveyId),
    queryFn: () => getSurveyVisibility(surveyId),
    enabled,
  });
