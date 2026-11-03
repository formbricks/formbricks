import "server-only";
import type { TChartQuery } from "@formbricks/types/analysis";
import { getAnswerQuestions } from "@/modules/ee/analysis/charts/lib/answer-questions";
import { collectAnswerQuestionIds } from "./answer-filter";
import { type TEmbeddedKeysScope, getDatasetEmbeddedKeys } from "./dataset-embedded-keys";
import { getEmbeddedMemberName } from "./embedded-member-name";
import type { TChartField, TDatasetChartFields } from "./field-catalog";
import { getChartFieldCatalog } from "./field-catalog";

/**
 * What a Feedback Dataset adds to the field catalog (`getChartFieldCatalog`): its embedded-data keys,
 * always, and its answerable questions when `withAnswerQuestions` is set or `query` holds an answer rule —
 * they cost two database reads, which a query without answer rules does not need.
 */
export const getDatasetChartFields = async (
  scope: TEmbeddedKeysScope,
  { query, withAnswerQuestions = false }: { query?: unknown; withAnswerQuestions?: boolean } = {}
): Promise<TDatasetChartFields> => {
  const filters = (query as TChartQuery | undefined)?.filters;
  const needsQuestions =
    withAnswerQuestions || (Array.isArray(filters) && collectAnswerQuestionIds(filters).length > 0);

  const [keys, answerQuestions] = await Promise.all([
    getDatasetEmbeddedKeys(scope),
    needsQuestions ? getAnswerQuestions(scope.workspaceId, scope.datasetId) : undefined,
  ]);

  return {
    embeddedFields: keys.map((key) => ({ name: getEmbeddedMemberName(key), key })),
    ...(answerQuestions ? { answerQuestions } : {}),
  };
};

/** One Feedback Dataset's whole field catalog. */
export const getDatasetChartFieldCatalog = async (scope: TEmbeddedKeysScope): Promise<TChartField[]> =>
  getChartFieldCatalog(await getDatasetChartFields(scope));
