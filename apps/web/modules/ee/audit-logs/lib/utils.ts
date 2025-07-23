const SENSITIVE_KEYS = [
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
  "stripeCustomerId",
  "fileName",
];

/**
 * Redacts sensitive data from the object by replacing the sensitive keys with "********".
 * @param obj - The object to redact.
 * @returns The object with the sensitive data redacted.
 */
export const redactPII = (obj: any, seen: WeakSet<any> = new WeakSet()): any => {
  if (obj instanceof Date) {
    return obj.toISOString();
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
        if (SENSITIVE_KEYS.some((sensitiveKey) => key.toLowerCase() === sensitiveKey)) {
          return [key, "********"];
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
