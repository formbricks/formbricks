"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { fetchAnswerQuestions } from "@/modules/ee/analysis/charts/lib/answer-questions-client";
import type { TAnswerQuestion } from "@/modules/ee/analysis/lib/answer-filter";
import { getChartFieldCatalog } from "@/modules/ee/analysis/lib/api-client";
import { isEmbeddedMemberName } from "@/modules/ee/analysis/lib/embedded-data-fields";
import type { TEmbeddedChartField } from "@/modules/ee/analysis/lib/field-catalog";

/** How long the builder reuses a dataset's fields: the server refreshes its key list every 15 minutes. */
const DATASET_FIELDS_STALE_MS = 5 * 60 * 1000;

export type TDatasetBuilderFields = {
  /** The dataset's embedded-data keys, each with the member it compiles to (ENG-6893). */
  embeddedFields: TEmbeddedChartField[];
  /** The questions an answer filter may name (ENG-6637). */
  answerQuestions: TAnswerQuestion[];
};

/**
 * What one Feedback Dataset adds to the chart builder's fields: its embedded-data keys, read off the
 * dataset's field catalog (the public `GET /api/v3/charts/fields`), and its answerable questions. Both
 * are empty until loaded, or without a dataset, so the builder offers its shared fields regardless.
 */
export const useDatasetChartFields = (
  workspaceId: string,
  feedbackDirectoryId: string | null | undefined
): TDatasetBuilderFields => {
  const datasetId = feedbackDirectoryId ?? "";
  const { data: catalog } = useQuery({
    queryKey: ["chartFieldCatalog", workspaceId, datasetId],
    queryFn: ({ signal }) => getChartFieldCatalog({ workspaceId, datasetId, signal }),
    enabled: datasetId.length > 0,
    staleTime: DATASET_FIELDS_STALE_MS,
  });
  const { data: answerQuestions = [] } = useQuery({
    queryKey: ["answerQuestions", workspaceId, datasetId],
    queryFn: ({ signal }) => fetchAnswerQuestions({ workspaceId, feedbackDirectoryId: datasetId, signal }),
    enabled: datasetId.length > 0,
    staleTime: DATASET_FIELDS_STALE_MS,
  });

  const embeddedFields = useMemo(
    () =>
      (catalog?.fields ?? [])
        .filter((field) => isEmbeddedMemberName(field.name))
        .map((field) => ({ name: field.name, key: field.label })),
    [catalog]
  );

  return { embeddedFields, answerQuestions };
};
