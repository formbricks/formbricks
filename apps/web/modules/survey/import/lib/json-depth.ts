/**
 * JSON nesting guard. V8's `JSON.parse` recurses per nesting level, so a few hundred thousand `[`
 * characters (a 2 MB file) throw a `RangeError` deep inside whatever touched the value first — a
 * crash that reads as a 500 instead of "this is not a survey". Depth is measured by a linear scan
 * before parsing, and iteratively on already-parsed values, so neither path recurses.
 */

/** Deeper than any survey document: blocks → elements → choices → labels is four levels. */
export const IMPORT_MAX_JSON_DEPTH = 64;

/** Maximum bracket nesting of a JSON text, ignoring brackets inside strings. Stops early past `limit`. */
export function measureJsonTextDepth(text: string, limit = IMPORT_MAX_JSON_DEPTH): number {
  let depth = 0;
  let max = 0;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === "{" || char === "[") {
      depth += 1;
      if (depth > max) max = depth;
      if (max > limit) return max;
    } else if (char === "}" || char === "]") depth -= 1;
  }

  return max;
}

/** Maximum nesting of a parsed value, measured with an explicit stack. Stops early past `limit`. */
export function measureJsonValueDepth(value: unknown, limit = IMPORT_MAX_JSON_DEPTH): number {
  const stack: { value: unknown; depth: number }[] = [{ value, depth: 0 }];
  let max = 0;

  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current.value === null || typeof current.value !== "object") continue;
    const depth = current.depth + 1;
    if (depth > max) max = depth;
    if (max > limit) return max;
    for (const nested of Object.values(current.value as Record<string, unknown>)) {
      if (nested !== null && typeof nested === "object") stack.push({ value: nested, depth });
    }
  }

  return max;
}

export function isJsonTooDeep(input: string | unknown, limit = IMPORT_MAX_JSON_DEPTH): boolean {
  return (
    (typeof input === "string" ? measureJsonTextDepth(input, limit) : measureJsonValueDepth(input, limit)) >
    limit
  );
}

/** `JSON.parse` behind the depth guard; returns null for anything that is not parseable or too deep. */
export function parseJsonBounded(text: string, limit = IMPORT_MAX_JSON_DEPTH): { value: unknown } | null {
  if (measureJsonTextDepth(text, limit) > limit) return null;
  try {
    return { value: JSON.parse(text) };
  } catch {
    return null;
  }
}
