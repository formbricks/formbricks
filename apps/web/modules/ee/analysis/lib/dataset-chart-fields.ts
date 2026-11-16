import "server-only";
import type { TChartQuery } from "@formbricks/types/analysis";
import { getAnswerQuestions } from "@/modules/ee/analysis/charts/lib/answer-questions";
import { collectAnswerQuestionIds } from "./answer-filter";
import {
  type TEmbeddedKeysScope,
  getDatasetEmbeddedKeys,
  resolveEmbeddedMemberKeys,
} from "./dataset-embedded-keys";
import { getDatasetTopics } from "./dataset-topics";
import { collectEmbeddedMemberNames } from "./embedded-data-fields";
import { getEmbeddedMemberName } from "./embedded-member-name";
import type { TChartField, TDatasetChartFields } from "./field-catalog";
import { getChartFieldCatalog } from "./field-catalog";

/**
 * What a Feedback Dataset adds to the field catalog (`getChartFieldCatalog`): its embedded-data keys,
 * always (the top keys, plus any key `query` names outside them), and its answerable questions when `withAnswerQuestions` is set or `query` holds an answer rule —
 * they cost two database reads, which a query without answer rules does not need.
 *
 * Its current topic labels come with `withTopics` (ENG-6989), one Hub read: for listing the catalog, and
 * for writing or previewing a query that names a topic field, where a filter value must be a current
 * label. Reading a saved chart leaves them out, so it keeps running whatever its taxonomy's state.
 */
export const getDatasetChartFields = async (
  scope: TEmbeddedKeysScope,
  {
    query,
    withAnswerQuestions = false,
    withTopics = false,
  }: { query?: unknown; withAnswerQuestions?: boolean; withTopics?: boolean } = {}
): Promise<TDatasetChartFields> => {
  const filters = (query as TChartQuery | undefined)?.filters;
  const needsQuestions =
    withAnswerQuestions || (Array.isArray(filters) && collectAnswerQuestionIds(filters).length > 0);

  const [keys, answerQuestions, topics] = await Promise.all([
    getDatasetEmbeddedKeys(scope),
    needsQuestions ? getAnswerQuestions(scope.workspaceId, scope.datasetId) : undefined,
    withTopics
      ? getDatasetTopics({ datasetId: scope.datasetId, organizationId: scope.organizationId })
      : undefined,
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
    ...(topics ? { topics } : {}),
  };
};

/** One Feedback Dataset's whole field catalog, its topic fields included when it has an active taxonomy. */
export const getDatasetChartFieldCatalog = async (scope: TEmbeddedKeysScope): Promise<TChartField[]> =>
  getChartFieldCatalog(await getDatasetChartFields(scope, { withTopics: true }));
