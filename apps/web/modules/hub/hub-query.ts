/**
 * Query-string serialization for the Hub client.
 *
 * `@formbricks/hub` serializes array query params comma-joined — `qs.stringify(query, { arrayFormat:
 * "comma" })` in its `internal/utils/query` — so `{ source_type: ["survey", "review"] }` goes out as
 * `?source_type=survey%2Creview`. The Hub declares every repeatable filter `style: form, explode: true`
 * and its spec states outright that comma-separated values are NOT split, so it reads that as one literal
 * value: a `400` for the enum filters, and for the string filters a `200` with an empty page, which a
 * caller reads as "there is no such feedback". This module is the fix, applied by overriding
 * `stringifyQuery` on the client in `hub-client.ts`.
 *
 * Deliberately free of `server-only`, `env` and any SDK import, so it can be unit-tested on its own.
 *
 * Everything except array handling matches the SDK's own behaviour, because this serializer is shared by
 * every endpoint on that client (taxonomy, semantic search, similar-records, tenants, webhooks,
 * enrichment-status) — feedback-record list/count are simply the only ones that pass arrays today. Note
 * that the SDK also routes `application/x-www-form-urlencoded` request bodies through `stringifyQuery`;
 * no such endpoint exists at present, but that is the other blast radius if one appears.
 */

/** Thrown for a query value this surface has no wire form for. */
export class HubQuerySerializationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HubQuerySerializationError";
  }
}

const appendScalar = (params: URLSearchParams, key: string, value: unknown): void => {
  if (value === null) {
    // Matches the SDK: a null becomes a present-but-empty param rather than being dropped.
    params.append(key, "");
    return;
  }

  switch (typeof value) {
    case "string":
    case "number":
    case "boolean":
      params.append(key, String(value));
      return;
    case "object":
      if (value instanceof Date) {
        params.append(key, value.toISOString());
        return;
      }
      // A nested object would need bracket keys, which nothing on this surface accepts. The SDK threw
      // here before 0.12.0; restoring that beats sending "[object Object]" as a filter value.
      throw new HubQuerySerializationError(
        `Cannot serialize a nested object for query parameter "${key}"; pass primitives or an array of primitives.`
      );
    default:
      throw new HubQuerySerializationError(
        `Cannot serialize a ${typeof value} for query parameter "${key}"; pass primitives or an array of primitives.`
      );
  }
};

/**
 * Serialize a Hub query object, emitting each element of an array as its own repeated parameter.
 *
 * An empty array throws rather than being dropped. The SDK drops it silently, and a dropped filter
 * *widens* the result set with no signal to the caller — the same failure class as a filter guarded by
 * truthiness. Every array filter is bounded by `.min(1)` in the v3 schemas, so this is a tripwire rather
 * than a reachable path.
 */
export function serializeHubQuery(query: object): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    // Undefined means "absent". Load-bearing: the param builders assign optional filters
    // unconditionally in places and rely on undefined never reaching the wire.
    if (value === undefined) continue;

    if (Array.isArray(value)) {
      if (value.length === 0) {
        throw new HubQuerySerializationError(
          `Query parameter "${key}" is an empty array, which would silently drop the filter instead of narrowing it.`
        );
      }
      for (const element of value) appendScalar(params, key, element);
      continue;
    }

    appendScalar(params, key, value);
  }

  // URLSearchParams uses form encoding, where a space becomes "+". Go decodes "+" as a space so the Hub
  // would read it correctly either way, but percent-encoding keeps this serializer byte-identical to the
  // SDK's for every non-array value — which is what makes "did this change the other endpoints?" a
  // question with a one-word answer. Lossless: a literal "+" in data is already "%2B" by this point.
  return params.toString().replace(/\+/g, "%20");
}
