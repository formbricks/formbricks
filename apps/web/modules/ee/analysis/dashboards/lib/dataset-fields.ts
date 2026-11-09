import "server-only";
import {
  type TEmbeddedKeysScope,
  resolveEmbeddedMemberKeys,
} from "@/modules/ee/analysis/lib/dataset-embedded-keys";
import { getDatasetTopics } from "@/modules/ee/analysis/lib/dataset-topics";
import { isEmbeddedMemberName } from "@/modules/ee/analysis/lib/embedded-data-fields";
import { isTopicDimensionId } from "@/modules/ee/analysis/lib/schema-definition";
import { getDashboardFilterField } from "./dashboard-filters";

/**
 * Whether a Feedback Dataset has the field a dashboard filter names (ADR-0026: a filter matches a chart by
 * field name in the chart's dataset). Every dataset has the shared catalog's fields. An embedded-data field
 * is the dataset's when one of its keys compiles to that member, which is the case exactly when
 * the dataset has the key, by its original name: the member name is derived from the key alone. A key
 * outside the dataset's top keys still counts, so a filter keeps matching a chart whose key grew rarer.
 *
 * A topic field (ENG-6989) is the dataset's unless it has no active taxonomy: a topic filter on such a
 * dataset's chart could match nothing, so the chart says it cannot be filtered by it. Only that state
 * counts. Topics Hub cannot answer for right now are still in the data Cube reads, and the dataset is not
 * the organization's to lose by its plan, which governs offering topics, not reading charts made of them.
 *
 * `fields` are the filter fields that will be asked about, so the embedded ones are resolved in one go.
 */
export const getDatasetFieldMatcher = async (
  scope: TEmbeddedKeysScope,
  fields: readonly string[]
): Promise<(field: string) => boolean> => {
  const embedded = [...new Set(fields.filter(isEmbeddedMemberName))];
  const [present, topics] = await Promise.all([
    resolveEmbeddedMemberKeys(scope, embedded).then((keys) => new Set(keys.keys())),
    fields.some(isTopicDimensionId)
      ? getDatasetTopics({ datasetId: scope.datasetId, organizationId: scope.organizationId })
      : undefined,
  ]);
  const hasTopics = topics?.status !== "inactive";
  return (field) => {
    if (isEmbeddedMemberName(field)) return present.has(field);
    if (isTopicDimensionId(field)) return hasTopics;
    return getDashboardFilterField(field) !== undefined;
  };
};
