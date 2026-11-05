import type { TTableFilter } from "./types";

/**
 * The values of an enum property that every filter on it allows — the intersection, since filters
 * combine with AND. A quick filter and `isAnyOf` allow their values; `equals` allows one value,
 * `notEquals` every value but one and `isNoneOf` every value but its own.
 *
 * Returns `null` when no filter touches the property (no constraint), and an empty array when the
 * filters exclude every value, which a table answers with an empty list without asking its backend.
 */
export const resolveEnumFilter = <TValue extends string>(
  filters: readonly TTableFilter[],
  property: string,
  allValues: readonly TValue[]
): TValue[] | null => {
  const relevant = filters.filter((filter) => filter.property === property);
  if (relevant.length === 0) return null;

  let allowed = new Set<TValue>(allValues);
  for (const filter of relevant) {
    let permitted: Set<string>;
    switch (filter.operator) {
      case "in":
      case "isAnyOf":
        permitted = new Set(filter.values);
        break;
      case "equals":
        permitted = new Set(filter.values.slice(0, 1));
        break;
      case "notEquals":
        permitted = new Set(allValues.filter((value) => value !== filter.values[0]));
        break;
      case "isNoneOf":
        permitted = new Set(allValues.filter((value) => !filter.values.includes(value)));
        break;
      default:
        continue;
    }
    allowed = new Set([...allowed].filter((value) => permitted.has(value)));
  }
  return allValues.filter((value) => allowed.has(value));
};
