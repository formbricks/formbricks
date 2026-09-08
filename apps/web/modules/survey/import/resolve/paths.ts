/** Small helpers for the dotted v3 paths (`blocks.0.elements.1.buttonUrl`) the resolver reports and edits. */

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getContainer(root: unknown, segments: string[]): unknown {
  let current: unknown = root;
  for (const segment of segments) {
    if (Array.isArray(current)) {
      current = current[Number(segment)];
    } else if (isRecord(current)) {
      current = current[segment];
    } else {
      return undefined;
    }
  }
  return current;
}

/** Delete the value at a dotted path. Returns whether something was there. */
export function deleteAtPath(root: unknown, path: string): boolean {
  const segments = path.split(".");
  const last = segments.pop();
  if (last === undefined) return false;

  const container = getContainer(root, segments);
  if (isRecord(container) && Object.hasOwn(container, last)) {
    delete container[last];
    return true;
  }
  return false;
}

export function getAtPath(root: unknown, path: string): unknown {
  return getContainer(root, path.split("."));
}

/**
 * A translatable map: a plain object whose values are all strings. Public shape (`{ "en-US": … }`),
 * so the keys are locale codes.
 */
export function isI18nMap(value: unknown): value is Record<string, string> {
  return (
    isRecord(value) &&
    Object.keys(value).length > 0 &&
    Object.values(value).every((entry) => typeof entry === "string")
  );
}
