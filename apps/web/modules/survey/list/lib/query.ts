import type { InfiniteData } from "@tanstack/react-query";
import type { TSurveyListItem, TSurveyOverviewFilters } from "@/modules/survey/list/types/survey-overview";
import type { TSurveyListPage } from "./v3-surveys-client";

type TSurveyListKeyInput = {
  workspaceId: string;
  limit: number;
  filters: TSurveyOverviewFilters;
};

export const surveyKeys = {
  all: ["surveys"] as const,
  lists: () => [...surveyKeys.all, "list"] as const,
  list: (input: TSurveyListKeyInput) => [...surveyKeys.lists(), input] as const,
};

export function flattenSurveyPages(data?: InfiniteData<TSurveyListPage>): TSurveyListItem[] {
  return data?.pages.flatMap((page) => page.data) ?? [];
}

export function removeSurveyFromInfiniteData(
  data: InfiniteData<TSurveyListPage> | undefined,
  surveyId: string
): InfiniteData<TSurveyListPage> | undefined {
  if (!data) {
    return data;
  }

  let surveyWasRemoved = false;

  const pages = data.pages.map((page) => {
    const nextData = page.data.filter((survey) => survey.id !== surveyId);
    if (nextData.length !== page.data.length) {
      surveyWasRemoved = true;
    }

    return {
      ...page,
      data: nextData,
    };
  });

  if (!surveyWasRemoved) {
    return data;
  }

  return {
    ...data,
    pages: pages.map((page) => ({
      ...page,
      meta: {
        ...page.meta,
        totalCount: page.meta.totalCount === null ? null : Math.max(0, page.meta.totalCount - 1),
      },
    })),
  };
}

export function updateSurveyInInfiniteData(
  data: InfiniteData<TSurveyListPage> | undefined,
  updatedSurvey: Pick<TSurveyListItem, "id"> & Partial<TSurveyListItem>
): InfiniteData<TSurveyListPage> | undefined {
  if (!data) {
    return data;
  }

  let surveyWasUpdated = false;

  const pages = data.pages.map((page) => ({
    ...page,
    data: page.data.map((survey) => {
      if (survey.id !== updatedSurvey.id) {
        return survey;
      }

      surveyWasUpdated = true;
      return {
        ...survey,
        ...updatedSurvey,
      };
    }),
  }));

  if (!surveyWasUpdated) {
    return data;
  }

  return {
    ...data,
    pages,
  };
}
