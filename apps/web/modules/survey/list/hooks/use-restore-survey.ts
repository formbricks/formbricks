"use client";

import { surveyKeys } from "@/modules/survey/list/lib/query";
import { restoreSurvey } from "@/modules/survey/list/lib/v3-surveys-client";
import { useSurveyRemovalMutation } from "./use-survey-removal-mutation";

// Restoring removes the survey from the "Archived" view (it is no longer archived). onSettled
// re-fetches so the default list picks it back up.
export const useRestoreSurvey = ({ queryKey }: { queryKey: ReturnType<typeof surveyKeys.list> }) =>
  useSurveyRemovalMutation({ queryKey, mutationFn: restoreSurvey });
