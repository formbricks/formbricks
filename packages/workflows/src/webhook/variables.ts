import { WEBHOOK_VARIABLE_MAX_PATHS } from "./limits";

/** Path segments refused everywhere a Variable path is read (ADR 0045). */
const UNSAFE_PATH_SEGMENTS = new Set(["__proto__", "prototype", "constructor"]);

export type TWebhookVariableValueType = "object" | "string" | "number" | "boolean" | "null";

/**
 * Why a payload path is offered as "not supported yet" instead of as a Variable: a list (loops are
 * Part 3, ENG-7173), an unsafe segment, or a key a dot path cannot address (empty, or containing a dot).
 */
export type TWebhookVariableNotSupportedReason = "list" | "unsafe_segment" | "unreachable_key";

export interface TWebhookVariables {
  variables: { path: string; valueType: TWebhookVariableValueType }[];
  notSupported: { path: string; reason: TWebhookVariableNotSupportedReason }[];
  /** True when the payload has more paths than `WEBHOOK_VARIABLE_MAX_PATHS`; the rest were not read. */
  truncated: boolean;
}

const valueTypeOf = (value: unknown): TWebhookVariableValueType | null => {
  if (value === null) return "null";
  switch (typeof value) {
    case "string":
      return "string";
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    case "object":
      return "object";
    default:
      return null;
  }
};

const notSupportedReason = (key: string, value: unknown): TWebhookVariableNotSupportedReason | null => {
  if (UNSAFE_PATH_SEGMENTS.has(key)) return "unsafe_segment";
  if (key === "" || key.includes(".")) return "unreachable_key";
  if (Array.isArray(value)) return "list";
  return null;
};

/**
 * The Variables a Sample payload offers to the @ picker: every object and scalar as a `payload.`
 * dot path, in document order, for the first `WEBHOOK_VARIABLE_MAX_PATHS` paths. Pure and
 * browser-safe, so the editor and the API derive the same list. Iterative, so a deep payload cannot
 * overflow the stack.
 */
export const detectWebhookVariables = (payload: Record<string, unknown>): TWebhookVariables => {
  const result: TWebhookVariables = { variables: [], notSupported: [], truncated: false };
  let visited = 0;

  // Entries are pushed in reverse so they pop in document order (depth-first, pre-order).
  const stack: Array<{ path: string; key: string; value: unknown }> = [];
  const pushChildren = (parentPath: string, object: Record<string, unknown>) => {
    const entries = Object.entries(object);
    for (let index = entries.length - 1; index >= 0; index--) {
      const [key, value] = entries[index];
      stack.push({ path: `${parentPath}.${key}`, key, value });
    }
  };
  pushChildren("payload", payload);

  while (stack.length > 0) {
    const { path, key, value } = stack.pop()!;
    if (visited >= WEBHOOK_VARIABLE_MAX_PATHS) {
      result.truncated = true;
      break;
    }
    visited++;

    const reason = notSupportedReason(key, value);
    if (reason) {
      result.notSupported.push({ path, reason });
      continue;
    }

    const valueType = valueTypeOf(value);
    if (!valueType) continue;
    result.variables.push({ path, valueType });
    if (valueType === "object") pushChildren(path, value as Record<string, unknown>);
  }

  return result;
};
