import { getAnswerBuilderQuestionId } from "@/modules/ee/analysis/lib/answer-filter";
import { isEmbeddedMemberName } from "@/modules/ee/analysis/lib/embedded-data-fields";
import type { TEmbeddedChartField } from "@/modules/ee/analysis/lib/field-catalog";
import { type FilterNode, isFilterGroup } from "@/modules/ee/analysis/lib/query-builder";

/** A field as the public field catalog (`GET /api/v3/charts/fields`) lists it. */
type TCatalogField = { name: string; label: string; key?: string };

/**
 * The embedded-data keys one dataset's field catalog lists (ENG-6893), each with the member it compiles to.
 * The key is the catalog's own `key`; a catalog without it lists the key as the label.
 */
export const toEmbeddedFields = (fields: readonly TCatalogField[]): TEmbeddedChartField[] =>
  fields
    .filter((field) => isEmbeddedMemberName(field.name))
    .map((field) => ({ name: field.name, key: field.key ?? field.label }));

/**
 * The embedded-data keys of several datasets' catalogs, one field per member, in key order. A key in
 * several datasets is one field: its member name is derived from the key alone.
 */
export const mergeEmbeddedFields = (
  catalogs: ReadonlyArray<readonly TCatalogField[]>
): TEmbeddedChartField[] => {
  const byName = new Map<string, TEmbeddedChartField>();
  for (const field of catalogs.flatMap((fields) => toEmbeddedFields(fields))) {
    if (!byName.has(field.name)) byName.set(field.name, field);
  }
  return [...byName.values()].sort((a, b) => a.key.localeCompare(b.key));
};

const isDatasetField = (field: string): boolean =>
  isEmbeddedMemberName(field) || getAnswerBuilderQuestionId(field) !== null;

/**
 * Whether saved filter rules or groupings name a field only the chart's dataset can name — an embedded-data
 * key or an answer rule's question. Until the dataset's fields load, such a rule has no name to show.
 */
export const namesDatasetField = (items: readonly (FilterNode | string)[]): boolean =>
  items.some((item) => {
    if (typeof item === "string") return isDatasetField(item);
    return isFilterGroup(item) ? namesDatasetField(item.children) : isDatasetField(item.field);
  });
