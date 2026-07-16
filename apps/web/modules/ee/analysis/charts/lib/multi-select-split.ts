/**
 * Server-side re-aggregation for MultipleChoiceMulti answers.
 *
 * INTERIM HACK — label-based split (no value_id is stored per option for multi-select yet;
 * that requires a hub-side change tracked separately). Known limitations:
 *   1. The same option label across survey languages still fragments into separate buckets.
 *   2. A choice label that literally contains ", " would be split incorrectly.
 * A correct fix needs per-option value_id rows emitted by the hub (ENG-1702).
 *
 * The ingestion join separator is ", " — see convertValueToHubFields in
 * apps/web/lib/feedback-source/transform.ts (Array.join(", ")).
 */

const MULTI_SELECT_SEPARATOR = ", ";

export type TCubeRow = Record<string, string | number | boolean | null | undefined>;

/**
 * Split multi-select rows (where one row holds a ", "-joined list of selected options
 * as `valueDimensionId`) into per-option rows, summing every measure key.
 *
 * Re-aggregation groups by (all NON-valueDimension, NON-measure keys) + (the split option
 * label), so a second dimension (e.g. a time bucket) keeps splits separate per bucket.
 *
 * Rows whose valueDimension is empty, null, or undefined pass through unchanged.
 *
 * @param rows          Raw rows from the Cube query.
 * @param valueDimensionId   The dimension key that holds the joined option string
 *                           (e.g. "FeedbackRecords.valueText").
 * @param measureKeys   The measure keys to sum (e.g. ["FeedbackRecords.count"]).
 *                      All other keys in the row are treated as grouping dimensions
 *                      and preserved as-is in the output rows.
 */
export function splitMultiSelectRows(
  rows: TCubeRow[],
  valueDimensionId: string,
  measureKeys: string[]
): TCubeRow[] {
  if (rows.length === 0) return [];

  const measureKeySet = new Set(measureKeys);

  // Map from composite key → accumulated row.
  const accumulated = new Map<string, TCubeRow>();

  for (const row of rows) {
    const rawValue = row[valueDimensionId];

    // Rows without a valueText pass through without splitting. We still accumulate
    // them in the same pass so the output is a single stable array.
    if (rawValue === null || rawValue === undefined || rawValue === "") {
      const groupKey = buildGroupKey(row, valueDimensionId, measureKeySet, rawValue ?? "");
      mergeIntoAccumulated(accumulated, groupKey, row, valueDimensionId, rawValue ?? "", measureKeys);
      continue;
    }

    const valueStr = String(rawValue);
    const options = valueStr.split(MULTI_SELECT_SEPARATOR);

    for (const option of options) {
      const trimmed = option.trim();
      if (!trimmed) continue;
      const groupKey = buildGroupKey(row, valueDimensionId, measureKeySet, trimmed);
      mergeIntoAccumulated(accumulated, groupKey, row, valueDimensionId, trimmed, measureKeys);
    }
  }

  return Array.from(accumulated.values());
}

/**
 * Build a stable string key that groups by dimension keys only — explicitly excluding
 * the value dimension (which is replaced by the split option) and all measure keys
 * (which are summed, not grouped by).
 */
function buildGroupKey(
  row: TCubeRow,
  valueDimensionId: string,
  measureKeySet: Set<string>,
  splitOption: string
): string {
  const parts: string[] = [];
  for (const [key, val] of Object.entries(row)) {
    if (key === valueDimensionId) continue;
    if (measureKeySet.has(key)) continue;
    parts.push(`${key}=${String(val ?? "")}`);
  }
  // Sort for stability regardless of Object.entries iteration order.
  parts.sort((a, b) => a.localeCompare(b));
  parts.push(`${valueDimensionId}=${splitOption}`);
  return parts.join("|");
}

function mergeIntoAccumulated(
  accumulated: Map<string, TCubeRow>,
  groupKey: string,
  sourceRow: TCubeRow,
  valueDimensionId: string,
  splitOption: string | null | undefined,
  measureKeys: string[]
): void {
  const existing = accumulated.get(groupKey);
  if (!existing) {
    // First occurrence — clone the row and set the split value.
    const newRow: TCubeRow = { ...sourceRow, [valueDimensionId]: splitOption };
    accumulated.set(groupKey, newRow);
    return;
  }

  // Subsequent occurrence — sum the measure keys.
  for (const measureKey of measureKeys) {
    const existingVal = existing[measureKey];
    const sourceVal = sourceRow[measureKey];
    if (typeof existingVal === "number" && typeof sourceVal === "number") {
      existing[measureKey] = existingVal + sourceVal;
    } else if (existingVal === undefined && typeof sourceVal === "number") {
      existing[measureKey] = sourceVal;
    }
  }
}
