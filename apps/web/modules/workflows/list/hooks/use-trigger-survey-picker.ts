"use client";

import { useQuery } from "@tanstack/react-query";
import { type TSurveyEnding, ZSurveyEndings } from "@formbricks/types/surveys/types";
import { getTextContent } from "@formbricks/types/surveys/validation";
import { parseV3ApiError } from "@/modules/api/lib/v3-client";
import { initialFilters } from "@/modules/survey/list/lib/constants";
import { listSurveys } from "@/modules/survey/list/lib/v3-surveys-client";

const SURVEY_LIST_LIMIT = 100;

interface TWorkflowSurveyOption {
  id: string;
  name: string;
}

interface TWorkflowSurveyEnding {
  id: string;
  label: string;
}

const endingDisplayLabel = (ending: TSurveyEnding): string => {
  if (ending.type === "endScreen") {
    const text = getTextContent(ending.headline?.default ?? "");
    if (text) return text;
  } else if (ending.type === "redirectToUrl") {
    const label = ending.label?.trim();
    if (label) return label;
  }
  return ending.id;
};

export const useWorkflowSurveyOptions = (workspaceId: string) => {
  const query = useQuery({
    queryKey: ["workflow-trigger", "surveys", workspaceId],
    queryFn: async ({ signal }) => {
      const page = await listSurveys({
        workspaceId,
        limit: SURVEY_LIST_LIMIT,
        filters: initialFilters,
        signal,
      });
      const options: TWorkflowSurveyOption[] = page.data.map((survey) => ({
        id: survey.id,
        name: survey.name,
      }));
      return options;
    },
  });
  return { ...query, options: query.data ?? [] };
};

export const useWorkflowSurveyEndings = (surveyId: string | null | undefined) => {
  const query = useQuery({
    queryKey: ["workflow-trigger", "survey-endings", surveyId],
    enabled: Boolean(surveyId),
    queryFn: async ({ signal }) => {
      const response = await fetch(`/api/v3/surveys/${surveyId}`, {
        method: "GET",
        cache: "no-store",
        signal,
      });
      if (!response.ok) {
        throw await parseV3ApiError(response);
      }
      const body = (await response.json()) as { data: { endings: unknown } };
      const parsed = ZSurveyEndings.safeParse(body.data.endings);
      const endings: TWorkflowSurveyEnding[] = parsed.success
        ? parsed.data.map((ending) => ({ id: ending.id, label: endingDisplayLabel(ending) }))
        : [];
      return endings;
    },
  });
  return { ...query, endings: query.data ?? [] };
};
