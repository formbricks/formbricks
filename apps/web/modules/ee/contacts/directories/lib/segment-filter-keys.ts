/** Deeper than any filter tree the segment editor can save; a stored value past it is not walked further. */
const MAX_FILTER_DEPTH = 128;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * The attribute keys a stored segment filter list names, at any nesting depth. Reads the raw `filters`
 * JSON rather than a parsed `TBaseFilters`, so a stored value the current schema would reject still answers
 * instead of throwing.
 */
export const collectAttributeKeysFromSegmentFilters = (filters: unknown, depth = 0): string[] => {
  if (!Array.isArray(filters) || depth > MAX_FILTER_DEPTH) return [];

  return filters.flatMap((filter: unknown) => {
    if (!isRecord(filter)) return [];
    const { resource } = filter;
    if (Array.isArray(resource)) return collectAttributeKeysFromSegmentFilters(resource, depth + 1);
    if (!isRecord(resource) || !isRecord(resource.root)) return [];
    const { type, contactAttributeKey } = resource.root;
    return type === "attribute" && typeof contactAttributeKey === "string" ? [contactAttributeKey] : [];
  });
};
