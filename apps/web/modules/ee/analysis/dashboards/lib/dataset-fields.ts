import "server-only";
import {
  type TEmbeddedKeysScope,
  resolveEmbeddedMemberKeys,
} from "@/modules/ee/analysis/lib/dataset-embedded-keys";
import { isEmbeddedMemberName } from "@/modules/ee/analysis/lib/embedded-data-fields";
import { getDashboardFilterField } from "./dashboard-filters";

/**
 * Whether a Feedback Dataset has the field a dashboard filter names (ADR-0024: a filter matches a chart by
 * field name in the chart's dataset). Every dataset has the shared catalog's fields. An embedded-data field
 * is the dataset's when one of its keys compiles to that member, which is the case exactly when
 * the dataset has the key, by its original name: the member name is derived from the key alone. A key
 * outside the dataset's top keys still counts, so a filter keeps matching a chart whose key grew rarer.
 *
 * `fields` are the filter fields that will be asked about, so the embedded ones are resolved in one go.
 */
export const getDatasetFieldMatcher = async (
  scope: TEmbeddedKeysScope,
  fields: readonly string[]
): Promise<(field: string) => boolean> => {
  const embedded = [...new Set(fields.filter(isEmbeddedMemberName))];
  const present = new Set((await resolveEmbeddedMemberKeys(scope, embedded)).keys());
  return (field) =>
    isEmbeddedMemberName(field) ? present.has(field) : getDashboardFilterField(field) !== undefined;
};
