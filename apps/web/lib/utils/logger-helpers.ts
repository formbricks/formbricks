import { isStringUrl } from "@/lib/utils/url";

/** `accessToken`, `access_token`, `access-token` and `ACCESS_TOKEN` are one key (ENG-3269). */
const normalizeKey = (key: string): string => key.toLowerCase().replaceAll(/[-_]/g, "");

const SENSITIVE_KEY_NAMES = [
  "email",
  "name",
  "password",
  "access_token",
  "refresh_token",
  "id_token",
  "twofactorsecret",
  "backupcodes",
  "session_state",
  "provideraccountid",
  "imageurl",
  "identityprovideraccountid",
  "locale",
  "token",
  "key",
  "secret",
  "code",
  "address",
  "phone",
  "hashedkey",
  "lookuphash",
  "apikey",
  "createdby",
  "lastusedat",
  "expiresat",
  "acceptorid",
  "creatorid",
  "firstname",
  "lastname",
  "userid",
  "attributes",
  "pin",
  "image",
  // Matched after `normalizeKey`, so casing and `-`/`_` in these entries do not matter.
  "stripecustomerid",
  "filename",
  "state",
  // Respondent identifiers and free text that ride inside larger objects (ENG-2873).
  "ipaddress",
  "useragent",
  "value_text",
  "translated_text",
];

const SENSITIVE_KEYS = new Set(SENSITIVE_KEY_NAMES.map(normalizeKey));

/**
 * A key containing one of these names a credential (`clientSecret`, `refreshToken`, `x_api_key`,
 * `passwordHash`, `tokenHash`, `secretKey`, `privateKey`), so it is redacted without having to be listed.
 * The same fragments as the integration credential pattern (`lib/integration/redact-credentials.ts`),
 * plus `signature`; that one stays separate because it must keep `token_type` literals type-valid.
 */
const CREDENTIAL_FRAGMENTS = [
  "token",
  "secret",
  "password",
  "apikey",
  "privatekey",
  "credential",
  "signature",
];

const isCredentialName = (normalizedKey: string): boolean =>
  CREDENTIAL_FRAGMENTS.some((fragment) => normalizedKey.includes(fragment));

/**
 * Listed keys are always redacted. A credential-named key is redacted unless its value cannot be a
 * credential: audit markers and counts such as `passwordResetMarker: true`,
 * `allowOrganizationOnlyApiKey: false` and `oauthAccessTokensRevoked: 2` stay readable.
 */
const shouldRedactEntry = (normalizedKey: string, value: unknown): boolean => {
  if (SENSITIVE_KEYS.has(normalizedKey)) return true;
  if (!isCredentialName(normalizedKey)) return false;
  return typeof value !== "boolean" && typeof value !== "number" && value !== null && value !== undefined;
};

/**
 * Keys whose value is respondent content rather than a field: a response's `data` and `variables`, a
 * contact's attribute snapshot, a feedback record's `metadata`. Exact-key redaction cannot reach inside
 * them — the inner keys are the customer's own element ids and attribute names, so no list can cover
 * them — and an audit reviewer needs "which fields changed", never the answers. A plain object under one
 * of these keys is therefore reduced to its field names and a count (ENG-2873). Arrays and scalars fall
 * through to the normal walk: a survey's `variables` are definitions, not content, and arrive as an array.
 */
const CONTENT_CONTAINERS = new Set(["data", "variables", "contactattributes", "embeddeddata", "metadata"]);

/** Query parameters masked in logged URLs on top of credential-named ones: OAuth `code`/`state`, a bare `key`. */
const URL_SENSITIVE_KEYS = new Set(["code", "state", "key"]);

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value) && !(value instanceof Date);

/** What a content container leaves behind in an audit event: the shape, not the values. */
const projectContent = (value: Record<string, unknown>) => {
  const fieldNames = Object.keys(value).sort((a, b) => a.localeCompare(b));
  return { redactedContent: true, fieldNames, fieldCount: fieldNames.length };
};

/**
 * Redacts sensitive data from the object by replacing the sensitive keys with "********".
 * @param obj - The object to redact.
 * @returns The object with the sensitive data redacted.
 */
export function redactPII(obj: Record<string, unknown>): Record<string, unknown>;
export function redactPII(obj: unknown, seen?: WeakSet<object>): unknown;
export function redactPII(obj: unknown, seen: WeakSet<object> = new WeakSet()): unknown {
  if (obj instanceof Date) {
    return obj.toISOString();
  }

  if (typeof obj === "string" && isStringUrl(obj)) {
    return sanitizeUrlForLogging(obj);
  }

  if (obj && typeof obj === "object") {
    if (seen.has(obj)) return "[Circular]";
    seen.add(obj);
  }
  if (Array.isArray(obj)) {
    return obj.map((v) => redactPII(v, seen));
  }
  if (obj && typeof obj === "object") {
    return Object.fromEntries(
      Object.entries(obj).map(([key, value]) => {
        const normalizedKey = normalizeKey(key);
        if (shouldRedactEntry(normalizedKey, value)) {
          return [key, "********"];
        }
        if (CONTENT_CONTAINERS.has(normalizedKey) && isPlainObject(value)) {
          return [key, projectContent(value)];
        }
        return [key, redactPII(value, seen)];
      })
    );
  }
  return obj;
}

/**
 * Computes the difference between two objects and returns the new object with the changes.
 * @param oldObj - The old object.
 * @param newObj - The new object.
 * @returns The difference between the two objects.
 */
export function deepDiff(
  oldObj: Record<string, unknown>,
  newObj: Record<string, unknown>
): Record<string, unknown> | undefined;
export function deepDiff(oldObj: unknown, newObj: unknown): unknown;
export function deepDiff(oldObj: unknown, newObj: unknown): unknown {
  if (typeof oldObj !== "object" || typeof newObj !== "object" || oldObj === null || newObj === null) {
    if (JSON.stringify(oldObj) !== JSON.stringify(newObj)) {
      return newObj;
    }
    return undefined;
  }

  const oldRecord = oldObj as Record<string, unknown>;
  const newRecord = newObj as Record<string, unknown>;
  const diff: Record<string, unknown> = {};
  const keys = new Set([...Object.keys(oldRecord), ...Object.keys(newRecord)]);
  for (const key of keys) {
    const valueDiff = deepDiff(oldRecord[key], newRecord[key]);
    if (valueDiff !== undefined) {
      diff[key] = valueDiff;
    }
  }
  return Object.keys(diff).length > 0 ? diff : undefined;
}

/**
 * Sanitizes a URL for logging by masking `code`, `state`, `key` and any credential-named parameter
 * (`token`, `access_token`, `apiKey`, `client_secret`, `x_signature`, …), matched like object keys in
 * `redactPII`.
 * @param url - The URL to sanitize.
 * @returns The sanitized URL.
 */
export const sanitizeUrlForLogging = (url: string): string => {
  try {
    const urlObj = new URL(url);

    for (const key of new Set(urlObj.searchParams.keys())) {
      const normalizedKey = normalizeKey(key);
      if (URL_SENSITIVE_KEYS.has(normalizedKey) || isCredentialName(normalizedKey)) {
        urlObj.searchParams.set(key, "********");
      }
    }

    return urlObj.origin + urlObj.pathname + (urlObj.search ? `${urlObj.search}` : "");
  } catch {
    return "[invalid-url]";
  }
};
