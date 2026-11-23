import {
  type TWorkflowHttpHeader,
  type TWorkflowHttpMethod,
  type TWorkflowHttpRequestActionConfig,
  type TWorkflowRunContext,
  WORKFLOW_HTTP_METHODS_WITH_BODY,
  WORKFLOW_HTTP_RUN_LIMITS,
  WORKFLOW_SECRET_MASK,
  WorkflowTemplateError,
  buildWorkflowQueryString,
  renderWorkflowHeaderValue,
  renderWorkflowJsonBody,
  renderWorkflowUrlPath,
} from "@formbricks/workflows";
import type { WorkflowHttpCall, WorkflowHttpResponse } from "./send-http-request";

/** How much of a request or response body run detail and samples keep (ENG-7168). */
const WORKFLOW_HTTP_LOGGED_BODY_BYTES = WORKFLOW_HTTP_RUN_LIMITS.loggedBodyBytes;

/** A request as run detail shows it: secret header values masked, the body capped unless kept for sending. */
export interface TWorkflowHttpRequestRecord {
  method: TWorkflowHttpMethod;
  url: string;
  headers: { name: string; value: string }[];
  body?: string;
  bodyTruncated?: boolean;
}

/** A response as run detail and samples keep it: at most 64 KB of body, parsed when it is JSON that fits. */
export interface TWorkflowHttpResponseRecord {
  status: number;
  contentType: string | null;
  body: unknown;
  bodyTruncated?: boolean;
}

const LINE_BREAKS = /[\r\n\u2028\u2029]/g;

/** The UTF-8 prefix of `text` that fits in `maxBytes`, and whether anything was cut. */
export const capUtf8 = (text: string, maxBytes: number): { text: string; truncated: boolean } => {
  const bytes = new TextEncoder().encode(text);
  if (bytes.length <= maxBytes) return { text, truncated: false };
  // `fatal: false` drops a character cut in half at the end rather than throwing.
  const cut = new TextDecoder("utf-8", { fatal: false }).decode(bytes.subarray(0, maxBytes));
  const REPLACEMENT_CHAR = "\uFFFD";
  return { text: cut.endsWith(REPLACEMENT_CHAR) ? cut.slice(0, -1) : cut, truncated: true };
};

const appendQuery = (url: string, query: string): string => {
  const parsed = new URL(url);
  parsed.hash = "";
  if (query) parsed.search = parsed.search ? `${parsed.search}&${query}` : `?${query}`;
  return parsed.toString();
};

/** The request record with its body capped for the log. */
export const capRequestRecord = (record: TWorkflowHttpRequestRecord): TWorkflowHttpRequestRecord => {
  if (record.body === undefined) return record;
  const { text, truncated } = capUtf8(record.body, WORKFLOW_HTTP_LOGGED_BODY_BYTES);
  return { ...record, body: text, ...(truncated ? { bodyTruncated: true } : {}) };
};

export type TBuiltWorkflowHttpCall =
  | { ok: true; call: WorkflowHttpCall; record: TWorkflowHttpRequestRecord }
  /** `secretRefused`: a stored secret was not sent because it is set for another host (ADR 0051). */
  | { ok: false; error: string; secretRefused?: true };

/**
 * A secret header's plaintext, nothing when it has no value, or why its stored value may not go with
 * this request (it is set for another host, ADR 0051).
 */
export type TWorkflowSecretResolver = (header: TWorkflowHttpHeader) => string | { error: string } | undefined;

const renderHeaders = (
  configHeaders: TWorkflowHttpRequestActionConfig["headers"],
  context: TWorkflowRunContext,
  resolveSecret: TWorkflowSecretResolver
):
  | { headers: Record<string, string>; recordedHeaders: TWorkflowHttpRequestRecord["headers"] }
  | { error: string; secretRefused?: true } => {
  const headers: Record<string, string> = {};
  const recordedHeaders: TWorkflowHttpRequestRecord["headers"] = [];
  for (const header of configHeaders) {
    if (header.secret === true) {
      const value = resolveSecret(header);
      if (value === undefined) return { error: `Secret header ${header.name} has no value; enter it again` };
      if (typeof value === "object") return { error: value.error, secretRefused: true };
      headers[header.name] = value.replaceAll(LINE_BREAKS, "");
      recordedHeaders.push({ name: header.name, value: WORKFLOW_SECRET_MASK });
      continue;
    }
    const value = renderWorkflowHeaderValue(header.value ?? "", context);
    headers[header.name] = value;
    recordedHeaders.push({ name: header.name, value });
  }
  return { headers, recordedHeaders };
};

/** The rendered JSON body, `undefined` when the method sends none, or why the template can't render. */
const renderBody = (
  config: TWorkflowHttpRequestActionConfig,
  context: TWorkflowRunContext
): string | undefined | { error: string } => {
  const hasBody = typeof config.body === "string" && config.body.trim() !== "";
  if (!hasBody || !WORKFLOW_HTTP_METHODS_WITH_BODY.has(config.method)) return undefined;
  try {
    return renderWorkflowJsonBody(config.body as string, context);
  } catch (error) {
    if (error instanceof WorkflowTemplateError) return { error: error.message };
    throw error;
  }
};

/**
 * Renders an HTTP request step into the call to send and its masked record (ENG-7168, ADR 0053). The
 * URL's origin is used as written; Variables go in only where the definition allows them, each the way
 * its place needs: URL path values as one encoded segment each (empty, `.` and `..` fail the step, and
 * the filled-in URL must keep its origin), query values URL-encoded, header values without line
 * breaks, the body as typed JSON. Runs, "Don't wait" deliveries, Test runs and Send test request all
 * build their call here, so the record's URL is the one sent.
 * `resolveSecret` gives a secret header's plaintext; a secret it can't resolve, or refuses for this
 * host, fails the build, so a request never goes out without a header its author configured.
 */
export const buildWorkflowHttpCall = (
  config: TWorkflowHttpRequestActionConfig,
  context: TWorkflowRunContext,
  resolveSecret: TWorkflowSecretResolver
): TBuiltWorkflowHttpCall => {
  let url: string;
  try {
    url = appendQuery(
      renderWorkflowUrlPath(config.url, context),
      buildWorkflowQueryString(config.queryParameters, context)
    );
  } catch (error) {
    if (error instanceof WorkflowTemplateError) return { ok: false, error: error.message };
    return { ok: false, error: "The HTTP request needs an absolute http(s) URL" };
  }

  const rendered = renderHeaders(config.headers, context, resolveSecret);
  if ("error" in rendered) return { ok: false, ...rendered };
  const { headers, recordedHeaders } = rendered;

  const renderedBody = renderBody(config, context);
  if (typeof renderedBody === "object") return { ok: false, error: renderedBody.error };
  const body = renderedBody;
  if (body !== undefined) {
    if (!Object.keys(headers).some((name) => name.toLowerCase() === "content-type")) {
      headers["content-type"] = "application/json";
      recordedHeaders.push({ name: "content-type", value: "application/json" });
    }
  }

  return {
    ok: true,
    call: { method: config.method, url, headers, ...(body === undefined ? {} : { body }) },
    record: { method: config.method, url, headers: recordedHeaders, ...(body === undefined ? {} : { body }) },
  };
};

const isJsonContentType = (contentType: string | null): boolean =>
  contentType !== null && /^application\/([\w.+-]*\+)?json\b/i.test(contentType.trim());

/** The body as later steps read it: parsed when the target says JSON and sent all of it, else text. */
const parseBody = (response: WorkflowHttpResponse): unknown => {
  if (!response.truncated && isJsonContentType(response.contentType)) {
    try {
      return JSON.parse(response.bodyText) as unknown;
    } catch {
      return response.bodyText;
    }
  }
  return response.bodyText;
};

/**
 * One response two ways: `variables` is what later steps read (`status`, the whole body up to 1 MB,
 * in memory only); `record` is what run detail and samples keep (≤64 KB, parsed only when it fits).
 * An echoed secret is masked in both: a later step could otherwise insert it into a call to another
 * host, past the secret's host binding (ADR 0051), and its run detail would keep it in plain text.
 */
export const summarizeWorkflowHttpResponse = (
  response: WorkflowHttpResponse,
  /** Secret header values this call sent; an endpoint that echoes them back gets them masked. */
  secretValues: readonly string[] = []
): { variables: { status: number; body: unknown }; record: TWorkflowHttpResponseRecord } => {
  const parsed = parseBody(response);
  // Masked after parsing, so a secret the JSON spells with escapes (`\/`, `\u0041`) is caught too.
  const variables = {
    status: response.status,
    body:
      typeof parsed === "string"
        ? maskSecretValues(parsed, secretValues)
        : maskSecretsInJson(parsed, secretValues),
  };
  const base = { status: response.status, contentType: response.contentType };
  if (typeof variables.body !== "string") {
    const body = variables.body;
    const serialized = JSON.stringify(body);
    if (new TextEncoder().encode(serialized).length <= WORKFLOW_HTTP_LOGGED_BODY_BYTES) {
      return { variables, record: { ...base, body } };
    }
  }
  const { text, truncated } = capUtf8(
    maskSecretValues(response.bodyText, secretValues),
    WORKFLOW_HTTP_LOGGED_BODY_BYTES
  );
  return {
    variables,
    record: { ...base, body: text, ...(truncated || response.truncated ? { bodyTruncated: true } : {}) },
  };
};

/** Shorter values are left alone: masking them would mangle ordinary text in the body. */
const MIN_MASKED_SECRET_LENGTH = 4;

/**
 * Each secret as raw text may spell it: as sent, JSON-escaped, and JSON-escaped with `\/` for `/`
 * (PHP's default). Other escapes are caught only where the body parses (`maskSecretsInJson`).
 */
const secretSpellings = (secretValues: readonly string[]): string[] =>
  [
    ...new Set(
      secretValues.flatMap((secret) => {
        const escaped = JSON.stringify(secret).slice(1, -1);
        return [secret, escaped, escaped.replaceAll("/", String.raw`\/`)];
      })
    ),
  ].sort((a, b) => b.length - a.length);

const maskSpellings = (text: string, spellings: readonly string[]): string =>
  spellings.reduce((masked, spelling) => masked.replaceAll(spelling, WORKFLOW_SECRET_MASK), text);

const maskSecretValues = (text: string, secretValues: readonly string[]): string =>
  maskSpellings(text, secretSpellings(secretValues));

/** A parsed JSON body with each secret masked in every string, object keys included. */
const maskSecretsInJson = (value: unknown, secretValues: readonly string[]): unknown => {
  if (secretValues.length === 0) return value;
  const spellings = secretSpellings(secretValues);
  const walk = (node: unknown): unknown => {
    if (typeof node === "string") return maskSpellings(node, spellings);
    if (Array.isArray(node)) return node.map(walk);
    if (node !== null && typeof node === "object") {
      return Object.fromEntries(
        Object.entries(node).map(([key, item]) => [maskSpellings(key, spellings), walk(item)])
      );
    }
    return node;
  };
  return walk(value);
};

/** Authorization schemes whose credential an endpoint may echo without the scheme (`/bearer`, introspection). */
const AUTH_SCHEMES = new Set(["bearer", "token", "basic", "bot", "apikey"]);
const SCHEME_AND_CREDENTIAL = /^([A-Za-z][\w-]*)\s+(\S+)$/;
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

/**
 * A secret header value and the credential inside it: after a known scheme, the token alone, and for
 * `Basic` the decoded `user:password` and the password. An endpoint that echoes only the token would
 * otherwise hand it to later steps in plain text, past the secret's host binding (ADR 0051).
 */
const secretValueForms = (value: string): string[] => {
  const match = SCHEME_AND_CREDENTIAL.exec(value.trim());
  if (!match || !AUTH_SCHEMES.has(match[1].toLowerCase())) return [value];
  const credential = match[2];
  if (match[1].toLowerCase() !== "basic" || !BASE64.test(credential)) return [value, credential];
  const decoded = Buffer.from(credential, "base64").toString("utf8");
  const password = decoded.slice(decoded.indexOf(":") + 1);
  return [value, credential, decoded, ...(decoded.includes(":") ? [password] : [])];
};

/**
 * The secret header values a call sent (the headers its record shows masked), with the credential
 * inside each. Run detail and samples are readable by people who may never see a secret (ADR 0043),
 * so a response that echoes one back must not carry it into storage.
 */
export const collectSentSecretValues = (
  call: WorkflowHttpCall,
  record: TWorkflowHttpRequestRecord
): string[] => {
  const sent = new Map(Object.entries(call.headers).map(([name, value]) => [name.toLowerCase(), value]));
  const values = record.headers
    .filter((header) => header.value === WORKFLOW_SECRET_MASK)
    .map((header) => sent.get(header.name.toLowerCase()))
    .filter((value): value is string => value !== undefined)
    .flatMap(secretValueForms)
    .filter((value) => value.length >= MIN_MASKED_SECRET_LENGTH);
  return [...new Set(values)];
};

/** An answer the step counts as an error: 4xx and 5xx. A 3xx is the response, since redirects aren't followed. */
export const isWorkflowHttpErrorStatus = (status: number): boolean => status >= 400;
