"use client";

import { surveyKeys } from "@/modules/survey/list/lib/query";
import { archiveSurvey } from "@/modules/survey/list/lib/v3-surveys-client";
import { useSurveyRemovalMutation } from "./use-survey-removal-mutation";

// Archiving removes the survey from the current view: the default list excludes archived surveys,
// and the "Archived" view excludes active ones. onSettled re-fetches so mixed-filter views correct.
export const useArchiveSurvey = ({ queryKey }: { queryKey: ReturnType<typeof surveyKeys.list> }) =>
  useSurveyRemovalMutation({ queryKey, mutationFn: archiveSurvey });
