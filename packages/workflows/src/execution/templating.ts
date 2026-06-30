import type { TWorkflowTriggerRunPayload } from "../types/runs";

/** Matches `{{ path.to.value }}` placeholders. Whitespace around the path is tolerated. */
const PLACEHOLDER_PATTERN = /\{\{\s*(?<path>[^}]+?)\s*\}\}/g;

/**
 * Resolves a dot-path against an arbitrary object graph. Returns `undefined` when any segment is
 * missing or the traversed value is not an object. Pure and total — never throws on bad input.
 */
const readPath = (source: unknown, path: string): unknown => {
  const segments = path.split(".");
  let current: unknown = source;

  for (const segment of segments) {
    if (current === null || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }

  return current;
};

/**
 * Stringifies a resolved placeholder value. Strings pass through; numbers/booleans are coerced;
 * objects/arrays are JSON-encoded; `null`/`undefined`/missing collapse to the fallback. Keeping this
 * deterministic is what lets the executor be unit-tested without any I/O.
 */
const stringifyValue = (value: unknown, fallback: string): string => {
  if (value === null || value === undefined) {
    return fallback;
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return fallback;
  }
};

export interface ResolvePlaceholderOptions {
  /** Fallback for missing paths. Defaults to an empty string. */
  fallback?: string;
  /** Applied to each resolved dynamic value before insertion (e.g. HTML-escaping). The author-controlled template structure is left untouched. */
  transform?: (value: string) => string;
}

/**
 * Resolves `{{response.*}}` (and any other `{{path}}`) placeholders in `template` against the run's
 * stored trigger payload. `response.email` resolves to `triggerPayload.data.response.email`; any other
 * dot-path is read from the payload root. Missing paths collapse to `fallback` (empty string by
 * default), mirroring the `ZWorkflowDataRef.fallback` convention. Pure: same inputs → same output.
 *
 * Pass `transform` to post-process each interpolated dynamic value (only the resolved value, never the
 * surrounding author template) — used to HTML-escape respondent-controlled input.
 */
export const resolvePlaceholders = (
  template: string,
  triggerPayload: TWorkflowTriggerRunPayload,
  options: ResolvePlaceholderOptions = {}
): string => {
  const { fallback = "", transform } = options;
  const responseData: Record<string, unknown> = triggerPayload.data ?? {};

  return template.replace(PLACEHOLDER_PATTERN, (...args: unknown[]) => {
    const groups = args[args.length - 1] as { path?: string } | undefined;
    const path = (groups?.path ?? "").trim();
    // `response.*` is the documented, primary namespace and maps onto `triggerPayload.data.response.*`.
    const value = path.startsWith("response.")
      ? readPath(responseData, path)
      : readPath(triggerPayload, path);

    const resolved = stringifyValue(value, fallback);
    return transform ? transform(resolved) : resolved;
  });
};
