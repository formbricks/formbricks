import { WORKFLOW_LIMITS } from "../types/limits";
import type { TWorkflowRunContext } from "./context";
import { WorkflowTemplateError, findWorkflowRecallTokens, renderWorkflowText } from "./insert";

/**
 * Variables in an HTTP request URL go in the path only (ADR 0053, narrowing ADR 0058). The origin
 * (scheme, host and port) is plain text, so a payload can change which resource is called on the
 * host, never which host is called. Each inserted value is one path segment: it is encoded like a URI
 * component, so `/`, `?`, `#`, `%` and `\` can't add segments, a query or a fragment, and a value that
 * is empty, `.` or `..` (also once decoded) fails the step instead of collapsing or climbing the path.
 * After insertion the URL is parsed again and must still have the saved origin. Variables in the
 * query keep going through the query parameter rows.
 */

const RECALL_PREFIX = "#recall:";

/**
 * Text up to a point in the URL where a Variable may go: `scheme://host[:port]/` and then path text
 * only, no query (`?`) or fragment (`#`) yet. Tokens already in the text count as path text.
 */
const PATH_POSITION = /^[a-z][a-z\d+.-]*:\/\/[^/?#\s]+\/[^?#]*$/i;

/** The text with each complete Variable token replaced by a plain path character. */
const withTokensAsPathText = (text: string): string => {
  let result = "";
  let copiedUpTo = 0;
  for (const token of findWorkflowRecallTokens(text)) {
    result += `${text.slice(copiedUpTo, token.start)}x`;
    copiedUpTo = token.end;
  }
  return result + text.slice(copiedUpTo);
};

/**
 * Whether a Variable may be inserted after `textBefore` (the URL typed so far): only once the path has
 * started, i.e. after the first `/` that follows the host, and before any `?` or `#`. The editor uses
 * it to offer the Variable picker in the URL field.
 */
export const isWorkflowUrlPathPosition = (textBefore: string): boolean =>
  PATH_POSITION.test(withTokensAsPathText(textBefore));

export type TWorkflowUrlTemplateIssue =
  /** A Variable in the scheme, host or port, or with no `/` before it. */
  | "variable_before_path"
  /** A Variable in the query or fragment; query Variables go in the query parameter rows. */
  | "variable_after_path"
  /** A `#recall:` that is not a complete Variable token (a survey answer id, an unclosed token). */
  | "not_a_variable";

export const WORKFLOW_URL_TEMPLATE_ISSUE_MESSAGES: Record<TWorkflowUrlTemplateIssue, string> = {
  variable_before_path:
    "Variables can only go in the URL path, after the host; the scheme, host and port are fixed",
  variable_after_path: "Variables can't go in the URL's query or fragment; use the query parameters instead",
  not_a_variable: "The URL can only insert Variables (#recall:<path>/fallback:<text>#)",
};

/** Why the URL's Variables are not allowed where they are, or null when it has none or all sit in the path. */
export const findWorkflowUrlTemplateIssue = (url: string): TWorkflowUrlTemplateIssue | null => {
  if (!url.includes(RECALL_PREFIX)) return null;
  const tokens = findWorkflowRecallTokens(url);
  // A `#recall:` left once the Variable tokens are taken out is something else.
  let rest = "";
  let copiedUpTo = 0;
  for (const token of tokens) {
    rest += url.slice(copiedUpTo, token.start);
    copiedUpTo = token.end;
  }
  if ((rest + url.slice(copiedUpTo)).includes(RECALL_PREFIX)) return "not_a_variable";

  for (const token of tokens) {
    const before = withTokensAsPathText(url.slice(0, token.start));
    if (PATH_POSITION.test(before)) continue;
    // Not in the path: either the path has not started yet, or a query or fragment has.
    return /^[a-z][a-z\d+.-]*:\/\/[^/?#\s]+\//i.test(before) ? "variable_after_path" : "variable_before_path";
  }
  return null;
};

/** The origin a URL template is fixed to: the one its text before the first Variable has. */
const fixedOrigin = (url: string): string | null => {
  const firstToken = url.indexOf(RECALL_PREFIX);
  try {
    return new URL(firstToken === -1 ? url : url.slice(0, firstToken)).origin;
  } catch {
    return null;
  }
};

/** `.` and `..` move along the path; an empty segment adds a `//` some servers collapse. */
const MOVES_THE_PATH = new Set(["", ".", ".."]);

/** Decoding stops after this many rounds; a value still changing by then is refused. */
const MAX_DECODE_ROUNDS = 3;

/** Whether a value, as typed or once percent-decoded (`%2e%2e`), is an empty, `.` or `..` segment. */
const movesThePath = (value: string): boolean => {
  let current = value;
  for (let round = 0; round <= MAX_DECODE_ROUNDS; round++) {
    if (MOVES_THE_PATH.has(current.trim())) return true;
    let decoded: string;
    try {
      decoded = decodeURIComponent(current);
    } catch {
      return false;
    }
    if (decoded === current) return false;
    current = decoded;
  }
  return true;
};

const utf8Bytes = (value: string): number => new TextEncoder().encode(value).length;

/**
 * The URL with its path Variables filled in, each as one encoded path segment. Throws a
 * `WorkflowTemplateError` naming the Variable when a value is empty, `.` or `..`, and when the result
 * is over the URL limit or no longer has the saved origin. A URL without Variables is returned as is.
 */
export const renderWorkflowUrlPath = (template: string, context: TWorkflowRunContext): string => {
  if (!template.includes(RECALL_PREFIX)) return template;
  const issue = findWorkflowUrlTemplateIssue(template);
  if (issue) throw new WorkflowTemplateError(WORKFLOW_URL_TEMPLATE_ISSUE_MESSAGES[issue]);
  const origin = fixedOrigin(template);
  if (!origin || origin === "null") {
    throw new WorkflowTemplateError("The HTTP request needs an absolute http(s) URL");
  }

  let rendered = "";
  let copiedUpTo = 0;
  for (const token of findWorkflowRecallTokens(template)) {
    const value = renderWorkflowText(template.slice(token.start, token.end), context);
    if (movesThePath(value)) {
      throw new WorkflowTemplateError(
        value.trim() === ""
          ? `The URL path Variable ${token.path} is empty`
          : `The URL path Variable ${token.path} can't be "." or ".."`
      );
    }
    rendered += template.slice(copiedUpTo, token.start) + encodeURIComponent(value);
    copiedUpTo = token.end;
  }
  rendered += template.slice(copiedUpTo);

  if (utf8Bytes(rendered) > WORKFLOW_LIMITS.maxHttpUrlBytes) {
    throw new WorkflowTemplateError(
      `The URL can be at most ${WORKFLOW_LIMITS.maxHttpUrlBytes.toString()} bytes once its Variables are filled in`
    );
  }
  let renderedOrigin: string | null;
  try {
    renderedOrigin = new URL(rendered).origin;
  } catch {
    renderedOrigin = null;
  }
  if (renderedOrigin !== origin) {
    throw new WorkflowTemplateError(
      "A Variable in the URL path changed the URL's host; the step was not sent"
    );
  }
  return rendered;
};
