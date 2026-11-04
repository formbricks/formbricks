"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { fetchAnswerQuestions } from "@/modules/ee/analysis/charts/lib/answer-questions-client";
import { mergeEmbeddedFields } from "@/modules/ee/analysis/charts/lib/catalog-embedded-fields";
import type { TAnswerQuestion } from "@/modules/ee/analysis/lib/answer-filter";
import type { TEmbeddedChartField } from "@/modules/ee/analysis/lib/field-catalog";
import { type TDatasetFieldsStatus, chartFieldCatalogQuery } from "./chart-field-catalog-query";

export type TDatasetBuilderFields = TDatasetFieldsStatus & {
  /** The dataset's embedded-data keys, each with the member it compiles to (ENG-6893). */
  embeddedFields: TEmbeddedChartField[];
  /** The questions an answer filter may name (ENG-6637). */
  answerQuestions: TAnswerQuestion[];
};

/**
 * What one Feedback Dataset adds to the chart builder's fields: its embedded-data keys, read off the
 * dataset's field catalog (the public `GET /api/v3/charts/fields`), and its answerable questions. Both
 * are empty until loaded, or without a dataset; `isLoading` and `error` let the builder hold back rules
 * that name them until they can be shown by name.
 */
export const useDatasetChartFields = (
  workspaceId: string,
  feedbackDirectoryId: string | null | undefined
): TDatasetBuilderFields => {
  const datasetId = feedbackDirectoryId ?? "";
  const catalog = useQuery(chartFieldCatalogQuery(workspaceId, datasetId));
  const questions = useQuery({
    ...chartFieldCatalogQuery(workspaceId, datasetId),
    queryKey: ["answerQuestions", workspaceId, datasetId],
    queryFn: ({ signal }) => fetchAnswerQuestions({ workspaceId, feedbackDirectoryId: datasetId, signal }),
  });

  const embeddedFields = useMemo(() => mergeEmbeddedFields([catalog.data?.fields ?? []]), [catalog.data]);
  const { refetch: refetchCatalog } = catalog;
  const { refetch: refetchQuestions } = questions;

  return {
    embeddedFields,
    answerQuestions: questions.data ?? [],
    isLoading: catalog.isLoading || questions.isLoading,
    error: catalog.error ?? questions.error,
    retry: () => {
      void refetchCatalog();
      void refetchQuestions();
    },
  };
};
