import "server-only";
import type { TChartQuery } from "@formbricks/types/analysis";
import { getAnswerQuestions } from "@/modules/ee/analysis/charts/lib/answer-questions";
import { collectAnswerQuestionIds } from "./answer-filter";
import {
  type TEmbeddedKeysScope,
  getDatasetEmbeddedKeys,
  resolveEmbeddedMemberKeys,
} from "./dataset-embedded-keys";
import { collectEmbeddedMemberNames } from "./embedded-data-fields";
import { getEmbeddedMemberName } from "./embedded-member-name";
import type { TChartField, TDatasetChartFields } from "./field-catalog";
import { getChartFieldCatalog } from "./field-catalog";

/**
 * What a Feedback Dataset adds to the field catalog (`getChartFieldCatalog`): its embedded-data keys,
 * always (the top keys, plus any key `query` names outside them), and its answerable questions when `withAnswerQuestions` is set or `query` holds an answer rule —
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
  const embeddedFields = keys.map((key) => ({ name: getEmbeddedMemberName(key), key }));

  // A saved query may name a key that has since fallen out of the top keys; it still exists, so the query
  // keeps working. Only the catalog (no `query`) is capped.
  const listed = new Set(embeddedFields.map(({ name }) => name));
  const outside = collectEmbeddedMemberNames(query).filter((name) => !listed.has(name));
  if (outside.length > 0) {
    for (const [name, key] of await resolveEmbeddedMemberKeys(scope, outside)) {
      embeddedFields.push({ name, key });
    }
  }

  return {
    embeddedFields,
    ...(answerQuestions ? { answerQuestions } : {}),
  };
};

/** One Feedback Dataset's whole field catalog. */
export const getDatasetChartFieldCatalog = async (scope: TEmbeddedKeysScope): Promise<TChartField[]> =>
  getChartFieldCatalog(await getDatasetChartFields(scope));
