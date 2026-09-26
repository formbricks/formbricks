import { isStringUrl } from "@/lib/utils/url";

const SENSITIVE_KEYS = new Set([
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
  // Compared lower-cased below, so entries have to be lower-case to match at all.
  "stripecustomerid",
  "filename",
  "state",
  // Respondent identifiers and free text that ride inside larger objects (ENG-2873).
  "ipaddress",
  "useragent",
  "value_text",
  "translated_text",
]);

/**
 * Keys whose value is respondent content rather than a field: a response's `data` and `variables`, a
 * contact's attribute snapshot, a feedback record's `metadata`. Exact-key redaction cannot reach inside
 * them — the inner keys are the customer's own element ids and attribute names, so no list can cover
 * them — and an audit reviewer needs "which fields changed", never the answers. A plain object under one
 * of these keys is therefore reduced to its field names and a count (ENG-2873). Arrays and scalars fall
 * through to the normal walk: a survey's `variables` are definitions, not content, and arrive as an array.
 */
const CONTENT_CONTAINERS = new Set(["data", "variables", "contactattributes", "embeddeddata", "metadata"]);

const URL_SENSITIVE_KEYS = ["token", "code", "state"];

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
export const redactPII = (obj: any, seen: WeakSet<any> = new WeakSet()): any => {
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
        const lowerKey = key.toLowerCase();
        if (SENSITIVE_KEYS.has(lowerKey)) {
          return [key, "********"];
        }
        if (CONTENT_CONTAINERS.has(lowerKey) && isPlainObject(value)) {
          return [key, projectContent(value)];
        }
        return [key, redactPII(value, seen)];
      })
    );
  }
  return obj;
};

/**
 * Computes the difference between two objects and returns the new object with the changes.
 * @param oldObj - The old object.
 * @param newObj - The new object.
 * @returns The difference between the two objects.
 */
export const deepDiff = (oldObj: any, newObj: any): any => {
  if (typeof oldObj !== "object" || typeof newObj !== "object" || oldObj === null || newObj === null) {
    if (JSON.stringify(oldObj) !== JSON.stringify(newObj)) {
      return newObj;
    }
    return undefined;
  }

  const diff: Record<string, any> = {};
  const keys = new Set([...Object.keys(oldObj ?? {}), ...Object.keys(newObj ?? {})]);
  for (const key of keys) {
    const valueDiff = deepDiff(oldObj?.[key], newObj?.[key]);
    if (valueDiff !== undefined) {
      diff[key] = valueDiff;
    }
  }
  return Object.keys(diff).length > 0 ? diff : undefined;
};

/**
 * Sanitizes a URL for logging by redacting sensitive parameters.
 * @param url - The URL to sanitize.
 * @returns The sanitized URL.
 */
export const sanitizeUrlForLogging = (url: string): string => {
  try {
    const urlObj = new URL(url);

    URL_SENSITIVE_KEYS.forEach((key) => {
      if (urlObj.searchParams.has(key)) {
        urlObj.searchParams.set(key, "********");
      }
    });

    return urlObj.origin + urlObj.pathname + (urlObj.search ? `${urlObj.search}` : "");
  } catch {
    return "[invalid-url]";
  }
};
