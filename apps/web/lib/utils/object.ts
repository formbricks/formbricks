export const capitalize = (value: string): string => {
  if (!value) return "";

  return `${value.charAt(0).toUpperCase()}${value.slice(1).toLowerCase()}`;
};

/** The keys a comparison counts: all of them, or, ignoring `undefined`, only those that hold a value. */
const comparedKeys = (record: Record<string, unknown>, ignoreUndefined: boolean): string[] =>
  ignoreUndefined ? Object.keys(record).filter((key) => record[key] !== undefined) : Object.keys(record);

const deepEqual = (left: unknown, right: unknown, ignoreUndefined: boolean): boolean => {
  if (Object.is(left, right)) return true;

  if (left instanceof Date && right instanceof Date) {
    return left.getTime() === right.getTime();
  }

  if (typeof left !== "object" || left === null || typeof right !== "object" || right === null) {
    return false;
  }

  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;

    return left.every((item, index) => deepEqual(item, right[index], ignoreUndefined));
  }

  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  const leftKeys = comparedKeys(leftRecord, ignoreUndefined);
  const rightKeys = comparedKeys(rightRecord, ignoreUndefined);

  if (leftKeys.length !== rightKeys.length) return false;

  return leftKeys.every(
    (key) =>
      Object.prototype.hasOwnProperty.call(rightRecord, key) &&
      deepEqual(leftRecord[key], rightRecord[key], ignoreUndefined)
  );
};

export const isDeepEqual = (left: unknown, right: unknown): boolean => deepEqual(left, right, false);

/**
 * `isDeepEqual`, reading a key that holds `undefined` as the same as a missing key. For comparing a value
 * that came back over JSON, which drops such keys, with one that never left the page, which keeps them.
 */
export const isDeepEqualIgnoringUndefined = (left: unknown, right: unknown): boolean =>
  deepEqual(left, right, true);
