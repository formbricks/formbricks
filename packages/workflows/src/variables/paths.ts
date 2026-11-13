import type { TWorkflowRunContext } from "./context";

/**
 * Where a Variable's value comes from. Only these prefixes are accepted, so later namespaces
 * (`run.`, `item.`) can be added without meeting saved workflows that already use them (ADR 0045).
 */
export const WORKFLOW_VARIABLE_SOURCES = ["payload", "steps", "response"] as const;
export type TWorkflowVariableSource = (typeof WORKFLOW_VARIABLE_SOURCES)[number];

/** Segments refused everywhere: reading them could reach an object's prototype. */
export const REFUSED_WORKFLOW_PATH_SEGMENTS: ReadonlySet<string> = new Set([
  "__proto__",
  "prototype",
  "constructor",
]);

/**
 * One path segment: the characters a recall id already allows. A key holding anything else (a dot,
 * a space, `/`, `#`) can't be reached, since the recall token couldn't carry it.
 */
export const WORKFLOW_PATH_SEGMENT_PATTERN_SOURCE = "[A-Za-z0-9_-]+";

/**
 * A whole Variable path as a regex source without anchors, for recall tokens:
 * `payload.a.b`, `steps.<stepId>…`, `response.<questionId>`.
 */
export const WORKFLOW_VARIABLE_PATH_PATTERN_SOURCE = String.raw`(?:payload|steps|response)(?:\.${WORKFLOW_PATH_SEGMENT_PATTERN_SOURCE})+`;

export const MAX_WORKFLOW_VARIABLE_PATH_LENGTH = 512;

const SEGMENT_PATTERN = new RegExp(`^${WORKFLOW_PATH_SEGMENT_PATTERN_SOURCE}$`);

export type TParsedWorkflowVariablePath =
  | { ok: true; source: TWorkflowVariableSource; segments: string[] }
  | { ok: false; error: string };

const isVariableSource = (value: string): value is TWorkflowVariableSource =>
  (WORKFLOW_VARIABLE_SOURCES as readonly string[]).includes(value);

const PREFIX_LIST = WORKFLOW_VARIABLE_SOURCES.map((source) => `${source}.`).join(", ");

/** Checks a Variable path's grammar. Pure; says nothing about whether the value exists in a run. */
export const parseWorkflowVariablePath = (path: string): TParsedWorkflowVariablePath => {
  if (path.length > MAX_WORKFLOW_VARIABLE_PATH_LENGTH) {
    return {
      ok: false,
      error: `Variable path is longer than ${MAX_WORKFLOW_VARIABLE_PATH_LENGTH} characters`,
    };
  }

  const [source, ...segments] = path.split(".");
  if (!isVariableSource(source)) {
    return { ok: false, error: `Variable path must start with ${PREFIX_LIST}` };
  }
  if (segments.length === 0) {
    return { ok: false, error: `Variable path ${source} must name a value after the prefix` };
  }

  for (const segment of segments) {
    if (REFUSED_WORKFLOW_PATH_SEGMENTS.has(segment)) {
      return { ok: false, error: `Variable path segment ${segment} is not allowed` };
    }
    if (!SEGMENT_PATTERN.test(segment)) {
      return { ok: false, error: "Variable path segments may only contain letters, digits, _ and -" };
    }
  }

  if (source === "response" && segments.length !== 1) {
    return { ok: false, error: "A response Variable names exactly one question: response.<questionId>" };
  }

  return { ok: true, source, segments };
};

export const isWorkflowVariablePath = (path: string): boolean => parseWorkflowVariablePath(path).ok;

export type TResolvedWorkflowVariable =
  | { found: true; value: unknown }
  | { found: false; reason: "invalid" | "missing" | "list" };

const MISSING: TResolvedWorkflowVariable = { found: false, reason: "missing" };
const LIST: TResolvedWorkflowVariable = { found: false, reason: "list" };

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Walks own properties only; a list on the way or at the end is refused until loops exist (ENG-7173). */
const readObjectPath = (root: unknown, segments: readonly string[]): TResolvedWorkflowVariable => {
  let current: unknown = root;
  for (const segment of segments) {
    if (Array.isArray(current)) return LIST;
    if (!isPlainRecord(current) || !Object.hasOwn(current, segment)) return MISSING;
    current = current[segment];
  }
  if (Array.isArray(current)) return LIST;
  if (current === undefined || current === null) return MISSING;
  return { found: true, value: current };
};

/**
 * Reads a Variable from a run's context. `null` and absent values are "missing", so the caller uses
 * the fallback. Survey answers that are lists keep their list (recall joins them in text); payload
 * and step-output paths that go into or end at a list are refused (`reason: "list"`).
 */
export const resolveWorkflowVariable = (
  context: TWorkflowRunContext,
  path: string
): TResolvedWorkflowVariable => {
  const parsed = parseWorkflowVariablePath(path);
  if (!parsed.ok) return { found: false, reason: "invalid" };

  switch (parsed.source) {
    case "payload":
      return context.payload ? readObjectPath(context.payload, parsed.segments) : MISSING;
    case "steps": {
      const [stepId, ...rest] = parsed.segments;
      if (!Object.hasOwn(context.steps, stepId)) return MISSING;
      return readObjectPath(context.steps[stepId], rest);
    }
    case "response": {
      const data = context.response?.data;
      const [questionId] = parsed.segments;
      if (!data || !Object.hasOwn(data, questionId)) return MISSING;
      const value = data[questionId];
      return value === undefined || value === null ? MISSING : { found: true, value };
    }
  }
};
