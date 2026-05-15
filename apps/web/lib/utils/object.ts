export const capitalize = (value: string): string => {
  if (!value) return "";

  return `${value.charAt(0).toUpperCase()}${value.slice(1).toLowerCase()}`;
};

export const isDeepEqual = (left: unknown, right: unknown): boolean => {
  if (Object.is(left, right)) return true;

  if (left instanceof Date && right instanceof Date) {
    return left.getTime() === right.getTime();
  }

  if (typeof left !== "object" || left === null || typeof right !== "object" || right === null) {
    return false;
  }

  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;

    return left.every((item, index) => isDeepEqual(item, right[index]));
  }

  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  const leftKeys = Object.keys(leftRecord);
  const rightKeys = Object.keys(rightRecord);

  if (leftKeys.length !== rightKeys.length) return false;

  return leftKeys.every(
    (key) =>
      Object.prototype.hasOwnProperty.call(rightRecord, key) && isDeepEqual(leftRecord[key], rightRecord[key])
  );
};
