"use client";

import { useQuery } from "@tanstack/react-query";
import { parseV3ApiError } from "@/modules/api/lib/v3-client";
import {
  type TSurveyLinkField,
  type TV3SurveyEmbeddedFieldLike,
  getSurveyLinkSettableFields,
} from "@/modules/ee/workflows/lib/survey-link-fields";

/**
 * The Embedded Data fields a Send email step's survey link can set, from the linked survey. `fields`
 * is null while loading or when the survey can't be read.
 */
export const useSurveyLinkFields = (
  surveyId: string | undefined
): { fields: TSurveyLinkField[] | null; isLoading: boolean } => {
  const query = useQuery({
    queryKey: ["workflow-email", "survey-link-fields", surveyId],
    enabled: Boolean(surveyId),
    queryFn: async ({ signal }) => {
      const response = await fetch(`/api/v3/surveys/${surveyId}`, { signal, cache: "no-store" });
      if (!response.ok) throw await parseV3ApiError(response);
      const body = (await response.json()) as {
        data: { embeddedFields?: TV3SurveyEmbeddedFieldLike[] };
      };
      return getSurveyLinkSettableFields(body.data.embeddedFields ?? []);
    },
  });
  return { fields: query.data ?? null, isLoading: query.isLoading };
};
