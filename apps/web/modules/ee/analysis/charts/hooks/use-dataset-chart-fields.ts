"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { toBuilderAnswerQuestions } from "@/modules/ee/analysis/charts/lib/catalog-answer-questions";
import { mergeEmbeddedFields } from "@/modules/ee/analysis/charts/lib/catalog-embedded-fields";
import type { TAnswerQuestion } from "@/modules/ee/analysis/lib/answer-filter";
import type { TEmbeddedChartField } from "@/modules/ee/analysis/lib/field-catalog";
import { type TDatasetFieldsStatus, chartFieldCatalogQuery } from "./chart-field-catalog-query";

export type TDatasetBuilderFields = TDatasetFieldsStatus & {
  /** The dataset's embedded-data keys, each with the member it compiles to. */
  embeddedFields: TEmbeddedChartField[];
  /** The questions an answer filter may name. */
  answerQuestions: TAnswerQuestion[];
};

/**
 * What one Feedback Dataset adds to the chart builder's fields: its embedded-data keys and its answerable
 * questions, both read off the dataset's public field catalog (`GET /api/v3/charts/fields`) — the same
 * read an API or MCP caller makes. Empty until loaded, or without a dataset; `isLoading` and `error` let
 * the builder hold back rules that name them until they can be shown by name.
 */
export const useDatasetChartFields = (
  workspaceId: string,
  feedbackDirectoryId: string | null | undefined
): TDatasetBuilderFields => {
  const datasetId = feedbackDirectoryId ?? "";
  const catalog = useQuery(chartFieldCatalogQuery(workspaceId, datasetId));

  const embeddedFields = useMemo(() => mergeEmbeddedFields([catalog.data?.fields ?? []]), [catalog.data]);
  const answerQuestions = useMemo(
    () => toBuilderAnswerQuestions(catalog.data?.answerQuestions),
    [catalog.data]
  );
  const { refetch } = catalog;

  return {
    embeddedFields,
    answerQuestions,
    isLoading: catalog.isLoading,
    error: catalog.error,
    retry: () => {
      void refetch();
    },
  };
};
