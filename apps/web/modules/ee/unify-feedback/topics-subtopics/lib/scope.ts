import type { TaxonomyFieldOption } from "@/modules/hub/types";

/** Stable identity for a (source, field) taxonomy scope and its parent source, used by the selectors. */
export const fieldKey = (field: TaxonomyFieldOption): string =>
  `${field.source_type}::${field.source_id}::${field.field_id}`;

export const sourceKey = (field: TaxonomyFieldOption): string => `${field.source_type}::${field.source_id}`;
