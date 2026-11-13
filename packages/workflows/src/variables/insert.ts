import type { TWorkflowRunContext } from "./context";
import { WORKFLOW_VARIABLE_PATH_PATTERN_SOURCE, resolveWorkflowVariable } from "./paths";

/**
 * Inserting Variables into a step's text (ADR 0045). Text fields reuse the recall token
 * `#recall:<path>/fallback:<text>#`; only tokens whose id is a Variable path are handled here, so a
 * token holding a bare question id keeps meaning a survey answer and is left for survey recall.
 *
 * How a value goes in depends on where (ENG-7165):
 * - query parameter value → URL-encoded (`buildWorkflowQueryString`);
 * - header value → line breaks stripped (`renderWorkflowHeaderValue`);
 * - JSON body → a token that is the whole string value keeps its type, inside a string it is text
 *   that JSON escaping covers (`renderWorkflowJsonBody`);
 * - email body → HTML-escaped (`renderWorkflowEmailBody`).
 * A missing value uses the fallback, else `null` in JSON and empty text elsewhere. The HTTP request
 * URL takes no Variables at all (ADR 0042); that is a definition rule, not an insertion mode.
 */

export class WorkflowTemplateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkflowTemplateError";
  }
}

const RECALL_PREFIX = "#recall:";
// Sticky: matched at each `#recall:` the scan finds. Only the path and the fallback marker; the
// fallback text runs to the next `#`, found with indexOf so a long run of open tokens stays linear.
const PATH_TOKEN_HEAD = new RegExp(`#recall:(${WORKFLOW_VARIABLE_PATH_PATTERN_SOURCE})/fallback:`, "y");

interface TPathToken {
  start: number;
  end: number;
  path: string;
  /** Fallback text as survey recall reads it (`nbsp` is how the editor stores a space). */
  fallback: string;
  /** Fallback exactly as written in the token. */
  rawFallback: string;
}

/** Every complete Variable-path recall token in `text`, in order. An unclosed token ends the scan. */
export const findWorkflowRecallTokens = (text: string): TPathToken[] => {
  const tokens: TPathToken[] = [];
  let searchFrom = 0;

  for (;;) {
    const start = text.indexOf(RECALL_PREFIX, searchFrom);
    if (start === -1) break;

    PATH_TOKEN_HEAD.lastIndex = start;
    const head = PATH_TOKEN_HEAD.exec(text);
    if (!head) {
      searchFrom = start + RECALL_PREFIX.length;
      continue;
    }

    const fallbackStart = PATH_TOKEN_HEAD.lastIndex;
    const close = text.indexOf("#", fallbackStart);
    if (close === -1) break;

    tokens.push({
      start,
      end: close + 1,
      path: head[1],
      fallback: text.slice(fallbackStart, close).replaceAll("nbsp", " "),
      rawFallback: text.slice(fallbackStart, close),
    });
    searchFrom = close + 1;
  }

  return tokens;
};

const replaceTokens = (text: string, replace: (token: TPathToken) => string): string => {
  const tokens = findWorkflowRecallTokens(text);
  if (tokens.length === 0) return text;

  let result = "";
  let copiedUpTo = 0;
  for (const token of tokens) {
    result += text.slice(copiedUpTo, token.start) + replace(token);
    copiedUpTo = token.end;
  }
  return result + text.slice(copiedUpTo);
};

/** A value as text: survey list answers joined with ", " as recall does, objects as JSON. */
const valueToText = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.filter((item) => item !== null && item !== "").join(", ");
  if (typeof value === "object" && value !== null) return JSON.stringify(value);
  return String(value);
};

const tokenText = (token: TPathToken, context: TWorkflowRunContext): string => {
  const resolved = resolveWorkflowVariable(context, token.path);
  return resolved.found ? valueToText(resolved.value) : token.fallback;
};

/** Plain text insertion; bare-id survey recall tokens are left as written. */
export const renderWorkflowText = (template: string, context: TWorkflowRunContext): string =>
  replaceTokens(template, (token) => tokenText(token, context));

/** `name=value&…` with every name and value (inserted Variables included) URL-encoded once. */
export const buildWorkflowQueryString = (
  parameters: readonly { name: string; value: string }[],
  context: TWorkflowRunContext
): string =>
  parameters
    .map(
      ({ name, value }) =>
        `${encodeURIComponent(name)}=${encodeURIComponent(renderWorkflowText(value, context))}`
    )
    .join("&");

const LINE_BREAKS = /[\r\n\u2028\u2029]/g;

/** A header value with line breaks stripped, so an inserted value can't start another header. */
export const renderWorkflowHeaderValue = (template: string, context: TWorkflowRunContext): string =>
  renderWorkflowText(template, context).replaceAll(LINE_BREAKS, "");

const renderJsonString = (value: string, context: TWorkflowRunContext): unknown => {
  const tokens = findWorkflowRecallTokens(value);
  const [only] = tokens;
  if (tokens.length === 1 && only.start === 0 && only.end === value.length) {
    const resolved = resolveWorkflowVariable(context, only.path);
    if (resolved.found) return resolved.value;
    return only.fallback === "" ? null : only.fallback;
  }
  return renderWorkflowText(value, context);
};

const renderJsonValue = (value: unknown, context: TWorkflowRunContext): unknown => {
  if (typeof value === "string") return renderJsonString(value, context);
  if (Array.isArray(value)) return value.map((item) => renderJsonValue(item, context));
  if (typeof value === "object" && value !== null) {
    // Keys are copied as written; only values take Variables.
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, renderJsonValue(item, context)])
    );
  }
  return value;
};

/**
 * Fills a JSON body template. Tokens go inside JSON strings: a string that is exactly one token
 * becomes the Variable's value with its type (a missing one becomes the fallback text, else `null`);
 * a token inside a longer string is inserted as text, which `JSON.stringify` escapes. A template
 * that is not valid JSON is refused rather than patched.
 */
export const renderWorkflowJsonBody = (template: string, context: TWorkflowRunContext): string => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(template);
  } catch {
    throw new WorkflowTemplateError("The JSON body template is not valid JSON");
  }
  return JSON.stringify(renderJsonValue(parsed, context));
};

const HTML_ENTITIES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};
const escapeHtml = (value: string): string => value.replaceAll(/[&<>"']/g, (char) => HTML_ENTITIES[char]);

/**
 * An email body: payload and step Variables go in HTML-escaped (data never becomes markup), and a
 * `response.<questionId>` token is rewritten to the bare `#recall:<questionId>/…#` survey recall
 * already expands, so answers keep recall's formatting (dates, lists joined with ", ").
 */
export const renderWorkflowEmailBody = (template: string, context: TWorkflowRunContext): string =>
  replaceTokens(template, (token) => {
    const [source, questionId] = token.path.split(".");
    if (source === "response") {
      return `${RECALL_PREFIX}${questionId}/fallback:${token.rawFallback}#`;
    }
    return escapeHtml(tokenText(token, context));
  });
