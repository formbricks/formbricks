import type { InfiniteData } from "@tanstack/react-query";
import { TSurveyListItem, TSurveyOverviewFilters } from "@/modules/survey/list/types/survey-overview";
import { TSurveyListPage } from "./v3-surveys-client";

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

export function updateSurveyInInfiniteData(
  data: InfiniteData<TSurveyListPage> | undefined,
  surveyId: string,
  patch: Partial<TSurveyListItem>
): InfiniteData<TSurveyListPage> | undefined {
  if (!data) {
    return data;
  }

  let surveyWasFound = false;

  const pages = data.pages.map((page) => {
    const nextData = page.data.map((survey) => {
      if (survey.id !== surveyId) {
        return survey;
      }
      surveyWasFound = true;
      return { ...survey, ...patch };
    });

    return {
      ...page,
      data: nextData,
    };
  });

  if (!surveyWasFound) {
    return data;
  }

  return {
    ...data,
    pages,
  };
}

/**
 * Drop a survey from the cached pages. `removesFromWorkspace` separates a delete, which takes the
 * survey out of the workspace, from an archive or restore, which only takes it out of this view.
 */
export function removeSurveyFromInfiniteData(
  data: InfiniteData<TSurveyListPage> | undefined,
  surveyId: string,
  { removesFromWorkspace = false }: { removesFromWorkspace?: boolean } = {}
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

  const decrement = (count: number | null) => (count === null ? null : Math.max(0, count - 1));

  return {
    ...data,
    pages: pages.map((page) => ({
      ...page,
      meta: {
        ...page.meta,
        totalCount: decrement(page.meta.totalCount),
        workspaceSurveyCount: removesFromWorkspace
          ? decrement(page.meta.workspaceSurveyCount)
          : page.meta.workspaceSurveyCount,
      },
    })),
  };
}
