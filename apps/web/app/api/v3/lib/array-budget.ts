import type { InvalidParam } from "./response";

/**
 * Longest array a v3 request may carry, at any depth. The same ceiling as `V3_SURVEY_BLOCK_ORDER_MAX`
 * — a valid block order lists every block, so nothing legitimate is longer than the largest survey.
 */
export const V3_REQUEST_ARRAY_MAX_ITEMS = 1000;

/**
 * Array elements a whole request may carry, summed over every array in it. A per-array cap alone
 * still lets 1,000 arrays of 1,000 junk entries through — a million elements inside the 2 MB body
 * limit — and Zod would report each one. The largest real survey document is a few thousand.
 */
export const V3_REQUEST_ARRAY_MAX_TOTAL_ELEMENTS = 50_000;

/**
 * How much of the offending array's path a violation reports. The path is caller-shaped too: a 120 KB
 * body of 60k nested arrays would otherwise put a 100 KB `name` into the 400, twice into the MCP error,
 * and once more into the warn log.
 */
const MAX_REPORTED_PATH_SEGMENTS = 10;
const MAX_REPORTED_SEGMENT_CHARS = 64;

export type TArrayBudgetViolation =
  | { kind: "array_too_long"; path: string; length: number }
  | { kind: "too_many_elements"; path: string; total: number };

/** One step of the walk's path, shared by reference so a deep body costs one node per level. */
type TPathNode = { segment: string; parent: TPathNode | null };

/**
 * Checks every array in a parsed JSON value against the two budgets above, before any schema sees it.
 *
 * Zod parses every element of an array before an array-level `.max()` runs, so an oversized array
 * costs one issue per element — ~500 MB of transient heap and a multi-megabyte 400 for a 200k-entry
 * array, reachable by any authenticated caller ahead of workspace authorization (ENG-3384). Field-level
 * bounds (`lengthBoundedArray`) cover the arrays a schema declares; this walk covers the ones it does
 * not — nested payloads typed as `unknown` or `z.record`, and every route that never opted in.
 *
 * Iterative on purpose: the input is caller-shaped, and a recursive walk over a deeply nested body
 * would overflow the stack before the budget was ever checked. Paths use the dotted form `invalid_params`
 * already uses (`blocks.3.elements`), cut to the first `MAX_REPORTED_PATH_SEGMENTS`; an empty path means
 * the root value itself.
 */
export function findArrayBudgetViolation(value: unknown): TArrayBudgetViolation | null {
  const stack: { value: unknown; path: TPathNode | null }[] = [{ value, path: null }];
  let total = 0;

  while (stack.length > 0) {
    const current = stack.pop();
    if (current === undefined) break;

    if (Array.isArray(current.value)) {
      if (current.value.length > V3_REQUEST_ARRAY_MAX_ITEMS) {
        return { kind: "array_too_long", path: renderPath(current.path), length: current.value.length };
      }

      total += current.value.length;
      if (total > V3_REQUEST_ARRAY_MAX_TOTAL_ELEMENTS) {
        return { kind: "too_many_elements", path: renderPath(current.path), total };
      }

      // Pushed in reverse so the walk visits elements in document order.
      for (let index = current.value.length - 1; index >= 0; index -= 1) {
        stack.push({ value: current.value[index], path: { segment: String(index), parent: current.path } });
      }
      continue;
    }

    if (typeof current.value === "object" && current.value !== null) {
      const entries = Object.entries(current.value);
      for (let index = entries.length - 1; index >= 0; index -= 1) {
        const [key, entry] = entries[index];
        stack.push({ value: entry, path: { segment: key, parent: current.path } });
      }
    }
  }

  return null;
}

/** The path root-first, at most `MAX_REPORTED_PATH_SEGMENTS` of them and each segment clipped. */
function renderPath(node: TPathNode | null): string {
  const segments: string[] = [];
  for (let cursor = node; cursor !== null; cursor = cursor.parent) {
    segments.push(cursor.segment);
  }
  segments.reverse();

  const shown = segments
    .slice(0, MAX_REPORTED_PATH_SEGMENTS)
    .map((segment) =>
      segment.length > MAX_REPORTED_SEGMENT_CHARS
        ? `${segment.slice(0, MAX_REPORTED_SEGMENT_CHARS)}…`
        : segment
    );
  if (segments.length > shown.length) {
    shown.push("…");
  }

  return shown.join(".");
}

/**
 * The violation as the one `invalid_params` entry a 400 carries. The per-array message is Zod's own
 * `too_big` wording, so a caller sees the same sentence whether the schema or this walk refused the
 * array.
 */
export function arrayBudgetInvalidParam(
  violation: TArrayBudgetViolation,
  fallbackName: string
): InvalidParam {
  const name = violation.path || fallbackName;

  if (violation.kind === "array_too_long") {
    return { name, reason: `Too big: expected array to have <=${V3_REQUEST_ARRAY_MAX_ITEMS} items` };
  }

  return {
    name,
    reason: `Too big: expected the request to carry <=${V3_REQUEST_ARRAY_MAX_TOTAL_ELEMENTS} array elements in total`,
  };
}
