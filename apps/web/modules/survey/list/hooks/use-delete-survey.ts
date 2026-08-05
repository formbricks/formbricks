"use client";

import { surveyKeys } from "@/modules/survey/list/lib/query";
import { deleteSurvey } from "@/modules/survey/list/lib/v3-surveys-client";
import { useSurveyRemovalMutation } from "./use-survey-removal-mutation";

export const useDeleteSurvey = ({ queryKey }: { queryKey: ReturnType<typeof surveyKeys.list> }) =>
  useSurveyRemovalMutation({ queryKey, mutationFn: deleteSurvey });
