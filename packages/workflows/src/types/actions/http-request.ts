import { z } from "zod";
import { ZWorkflowNodeBase } from "../common";
import { WORKFLOW_LIMITS } from "../limits";
import { WORKFLOW_ACTIONS } from "./enum";

/**
 * HTTP request action (ENG-7168, ADRs 0042 and 0043). The URL is fixed: Variables go only in query
 * parameter values, header values and the JSON body, so a payload can change what is sent but never
 * where it goes. Headers are plain (`{name, value}`) or secret: a secret's value lives encrypted in a
 * `WorkflowSecret` row and the definition stores only `{name, secret: true, secretId}`.
 *
 * Header shapes by direction:
 * - write (API / MCP): `{name, value}` plain, `{name, value, secret: true}` sets or replaces a secret,
 *   `{name, secret: true}` (with or without `isSet`) keeps the stored secret of that name;
 * - stored: `{name, value}` or `{name, secret: true, secretId?}` (no `secretId` = no value yet);
 * - read: `{name, value}` or `{name, secret: true, isSet}`, never the value or the `secretId`.
 * The server swaps values for ids on write and ids for `isSet` on read; a client-sent `secretId` is
 * ignored, so a workflow can never point at another workflow's secret.
 */

export const WORKFLOW_HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
export const ZWorkflowHttpMethod = z.enum(WORKFLOW_HTTP_METHODS);
export type TWorkflowHttpMethod = z.infer<typeof ZWorkflowHttpMethod>;

/** Methods that send the JSON body; GET and DELETE never do. */
export const WORKFLOW_HTTP_METHODS_WITH_BODY: ReadonlySet<TWorkflowHttpMethod> = new Set([
  "POST",
  "PUT",
  "PATCH",
]);

/** "Wait and use it" (`wait`) or "Don't wait" (`dont_wait`). */
export const ZWorkflowHttpResponseMode = z.enum(["wait", "dont_wait"]);
export type TWorkflowHttpResponseMode = z.infer<typeof ZWorkflowHttpResponseMode>;

/** A secret header's value as the editor shows it, and as run detail records it. */
export const WORKFLOW_SECRET_MASK = "••••••";

const MAX_HEADER_NAME_LENGTH = 256;
const MAX_HEADER_VALUE_LENGTH = 8 * 1024;
const MAX_QUERY_PARAMETERS = 30;
const MAX_QUERY_NAME_LENGTH = 256;
const MAX_QUERY_VALUE_LENGTH = 2 * 1024;

// RFC 9110 field-name token characters.
const HEADER_NAME_PATTERN = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;

/**
 * Headers the transport sets itself. Letting a step set them would desync framing or, for `Host`,
 * send the request to one virtual host on an address checked for another.
 */
const TRANSPORT_HEADER_NAMES: ReadonlySet<string> = new Set([
  "host",
  "content-length",
  "transfer-encoding",
  "connection",
  "keep-alive",
  "upgrade",
  "te",
  "trailer",
  "expect",
]);

const DEFAULT_SECRET_HEADER_NAME_PARTS = ["token", "key", "secret", "cookie"];

/**
 * Header names that are secret unless the author says otherwise ("locked by default"): `Authorization`
 * and names containing token, key, secret or cookie. A write that omits `secret` for one of these
 * stores it as a secret, so an API key never lands in the definition, its versions or audit logs.
 */
export const isDefaultSecretHeaderName = (name: string): boolean => {
  const lower = name.toLowerCase();
  return lower === "authorization" || DEFAULT_SECRET_HEADER_NAME_PARTS.some((part) => lower.includes(part));
};

const utf8Bytes = (value: string): number => new TextEncoder().encode(value).length;

const RECALL_TOKEN_MARKER = "#recall:";

// CR, LF and the Unicode line/paragraph separators: a header value with one could start another header.
const LINE_BREAK = new RegExp(String.raw`[\r\n\u2028\u2029]`);
const SECRET_VALUE_LINE_BREAK_MESSAGE = "A secret header value can't contain line breaks";

/**
 * A secret header's value as written, inline in a definition or through Replace (ADR 0043). It is
 * sent exactly as typed, so it takes no Variables and no line breaks; at most 8 KB.
 */
export const ZWorkflowSecretHeaderValue = z
  .string()
  .min(1)
  .max(MAX_HEADER_VALUE_LENGTH)
  .refine((value) => !LINE_BREAK.test(value), { message: SECRET_VALUE_LINE_BREAK_MESSAGE });

export const ZWorkflowHttpHeader = z
  .object({
    name: z
      .string()
      .min(1)
      .max(MAX_HEADER_NAME_LENGTH)
      .regex(HEADER_NAME_PATTERN, "Header names may only contain letters, digits and !#$%&'*+-.^_`|~")
      .refine((name) => !TRANSPORT_HEADER_NAMES.has(name.toLowerCase()), {
        message: "This header is set by Formbricks and can't be changed",
      }),
    value: z
      .string()
      .max(MAX_HEADER_VALUE_LENGTH)
      .optional()
      .describe(
        "Plain header value (may use Variables). For a secret header, a new value to store; never returned."
      ),
    secret: z
      .boolean()
      .optional()
      .describe(
        "True for a secret header: its value is stored encrypted and never shown again. Defaults to true for Authorization and names containing token, key, secret or cookie."
      ),
    secretId: z
      .string()
      .min(1)
      .optional()
      .describe("Server-managed reference to the stored secret value. Ignored on write, never returned."),
    isSet: z.boolean().optional().describe("Read only: whether a secret header has a stored value."),
  })
  .superRefine((header, ctx) => {
    if (header.secret !== true && header.value === undefined) {
      ctx.addIssue({ code: "custom", message: "A plain header needs a value", path: ["value"] });
    }
    const isSecret = header.secret ?? isDefaultSecretHeaderName(header.name);
    if (isSecret && header.value !== undefined && LINE_BREAK.test(header.value)) {
      ctx.addIssue({ code: "custom", message: SECRET_VALUE_LINE_BREAK_MESSAGE, path: ["value"] });
    }
  });
export type TWorkflowHttpHeader = z.infer<typeof ZWorkflowHttpHeader>;

export const ZWorkflowHttpQueryParameter = z.object({
  name: z.string().min(1).max(MAX_QUERY_NAME_LENGTH),
  value: z
    .string()
    .max(MAX_QUERY_VALUE_LENGTH)
    .describe("May use Variables; URL-encoded when the request is sent."),
});
export type TWorkflowHttpQueryParameter = z.infer<typeof ZWorkflowHttpQueryParameter>;

export const ZWorkflowHttpRequestActionConfig = z
  .object({
    method: ZWorkflowHttpMethod,
    url: z
      .string()
      .refine((url) => utf8Bytes(url) <= WORKFLOW_LIMITS.maxHttpUrlBytes, {
        message: `The URL can be at most ${WORKFLOW_LIMITS.maxHttpUrlBytes.toString()} bytes`,
      })
      .refine((url) => !url.includes(RECALL_TOKEN_MARKER), {
        message:
          "The URL can't use Variables; put them in query parameters, header values or the body instead",
      })
      .describe(
        "Fixed https URL. Takes no Variables (ADR 0042); plain http only where the instance allows it."
      ),
    queryParameters: z.array(ZWorkflowHttpQueryParameter).max(MAX_QUERY_PARAMETERS).default([]),
    headers: z
      .array(ZWorkflowHttpHeader)
      .max(WORKFLOW_LIMITS.maxHttpHeaders)
      .default([])
      .superRefine((headers, ctx) => {
        const seen = new Set<string>();
        for (const [index, header] of headers.entries()) {
          const key = header.name.toLowerCase();
          if (seen.has(key)) {
            ctx.addIssue({ code: "custom", message: `Header ${header.name} is set twice`, path: [index] });
          }
          seen.add(key);
        }
      }),
    body: z
      .string()
      .refine((body) => utf8Bytes(body) <= WORKFLOW_LIMITS.maxHttpBodyTemplateBytes, {
        message: `The body template can be at most ${WORKFLOW_LIMITS.maxHttpBodyTemplateBytes.toString()} bytes`,
      })
      .nullish()
      .describe(
        "JSON body template for POST, PUT and PATCH. A string that is exactly one Variable keeps the Variable's type."
      ),
    responseMode: ZWorkflowHttpResponseMode.default("wait").describe(
      "wait: later steps can use the response. dont_wait: the call is sent in the background and the run moves on."
    ),
    continueOnError: z
      .boolean()
      .default(false)
      .describe("When true, a failed call does not fail the run; later steps read its status."),
  })
  .describe("HTTP request action config.");
export type TWorkflowHttpRequestActionConfig = z.infer<typeof ZWorkflowHttpRequestActionConfig>;

export const ZWorkflowHttpRequestActionNode = ZWorkflowNodeBase.extend({
  type: z.literal("action"),
  actionType: z.literal(WORKFLOW_ACTIONS.HTTP_REQUEST),
  config: ZWorkflowHttpRequestActionConfig,
});
export type TWorkflowHttpRequestActionNode = z.infer<typeof ZWorkflowHttpRequestActionNode>;

/** Whether a header is a secret one, whatever its write/stored/read shape. */
export const isWorkflowSecretHeader = (header: Pick<TWorkflowHttpHeader, "secret">): boolean =>
  header.secret === true;
