"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { listWorkflowTestResponses } from "@/modules/ee/workflows/lib/api-client";
import { workflowKeys } from "@/modules/ee/workflows/lib/query";

/**
 * The trigger survey's responses for a Response completed workflow's Test run picker (ADR 0049),
 * newest first, a page at a time ("Load more"). Off until there is a survey to list.
 */
export const useWorkflowTestResponses = ({
  workflowId,
  surveyId,
  enabled,
}: {
  workflowId: string;
  surveyId: string | null;
  enabled: boolean;
}) => {
  const query = useInfiniteQuery({
    queryKey: workflowKeys.testResponses(workflowId, surveyId ?? ""),
    initialPageParam: null as string | null,
    enabled: enabled && surveyId !== null,
    queryFn: ({ pageParam, signal }) => listWorkflowTestResponses({ workflowId, cursor: pageParam, signal }),
    getNextPageParam: (lastPage) => lastPage.meta.nextCursor ?? undefined,
  });

  return { ...query, responses: query.data?.pages.flatMap((page) => page.data) ?? [] };
};
