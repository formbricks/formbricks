import type { TEmbeddedDataType } from "./embedded-data";
import { type TLinkedEmbeddedField, coerceToEmbeddedDataType } from "./embedded-data-resolver";
import type { TResponseData, TResponseDataValue } from "./responses";
import { matchDeclaredFieldName } from "./safe-identifier";

/**
 * **The write-side contract for Embedded Data (ENG-1845).** One module, two enforcement layers: the
 * renderer runs it at display time for immediate developer feedback, and every server ingest
 * boundary re-runs it because the client's filtering is never trusted. Both ingestion paths — URL
 * params (ENG-1843) and `setEmbeddedData` (ENG-1844) — adapt their input into
 * {@link applyIngestContract} rather than restating a rule of their own.
 *
 * Its counterpart is embedded-data-resolver.ts, which owns the *read* seam. The two have to agree,
 * and that agreement is structural rather than reviewed: every value this module accepts without a
 * flag is checked against {@link coerceToEmbeddedDataType} before it is returned, so a stored value
 * that the read seam would report as unset can only ever be a flagged one.
 */

/**
 * Byte ceiling for one ingested value, measured as UTF-8 rather than `.length` — the database column
 * is `Json` with no constraint of its own, so this is where the bound lives.
 *
 * Truncate-and-flag rather than reject: an oversize value is usually an auto-captured page URL or a
 * pasted blob, and losing the whole response over it is the worse failure. Applied to string results
 * only — a 16 KB number is not a thing.
 *
 * Deliberately not a cap on `ZResponseData` as a whole: there is none today, and `charLimit` is
 * authoring-only, so a blanket cap at the response-input boundary would start truncating open-text
 * answers. The rule the ticket also lists — `name` ≤ 255 — has no boundary to enforce it at: `name`
 * is not part of the response payload, and the library `key` is already capped at 255 by
 * `ZEmbeddedData`.
 */
export const MAX_INGESTED_VALUE_BYTES = 16 * 1024;

/**
 * Why a stored value will not read back as its declared type.
 *
 * - `coercion_failed` — the value could not be coerced to the field's `dataType`, so what arrived was
 *   kept verbatim. The read seam reports the field as unset (and falls back to `defaultValue`), which
 *   is why the flag has to be persisted: without it there is nothing left to tell a wrong-typed value
 *   apart from an absent one. Surfacing it in the UI is v2; storing it is not.
 * - `truncated` — the value exceeded {@link MAX_INGESTED_VALUE_BYTES} and was cut on a code-point
 *   boundary.
 */
export type TIngestFlagReason = "coercion_failed" | "truncated";

/** One thing worth remembering about one stored key. Keyed by `storageKey`, never by the incoming name. */
export interface TIngestFlag {
  key: string;
  reason: TIngestFlagReason;
}

/**
 * Why an incoming key did not become a stored value. Never an error — a bad key must not block a
 * response — but always reported, so the call site can log it against its own logger. That is also
 * why this module carries no logging of its own: `@formbricks/types` is imported by the renderer, the
 * SDKs and the server, and each has a different one.
 *
 * - `unknown_key` — no ingested field declares it (rules 1 and 2: `computed` fields are written by
 *   survey logic and `reserved` ones are read-only, so neither is addressable from outside).
 * - `locked_field` — the field ignores external writes and resolves to its `defaultValue` (rule 3).
 * - `unsupported_value` — nothing storable arrived under the key: `null`, `undefined`, a non-scalar
 *   under a declared field, or — under a question's element id — a shape `response.data` cannot
 *   hold, such as a nested object.
 * - `element_id_collision` — a question answer owns that address, and an answer is never rewritten.
 */
export type TIngestDropReason = "unknown_key" | "locked_field" | "unsupported_value" | "element_id_collision";

export interface TIngestDrop {
  /**
   * The declared `storageKey` whenever a declared field is involved, and the incoming key only for
   * `unknown_key`, where nothing declares it and the spelling that arrived *is* the whole finding.
   *
   * Same convention as {@link TIngestFlag.key} on purpose, so the two lists join by key: a consumer
   * grouping "what happened to this field" cannot do that if one side reports `Plan` and the other
   * the `plan` that arrived. It also keeps the identity stable — matching is case-tolerant, so the
   * incoming spelling varies per request while the declared one does not, and grepping a field's
   * name has to find every drop against it.
   */
  key: string;
  reason: TIngestDropReason;
}

export interface TIngestResult {
  /** What to store: the accepted values under their declared `storageKey`, plus question answers untouched. */
  data: TResponseData;
  flags: TIngestFlag[];
  dropped: TIngestDrop[];
}

/** The canonical stored form of one value, plus the reason it will not read back cleanly. */
export interface TNormalizedIngestValue {
  value: TResponseDataValue;
  flag?: TIngestFlagReason;
}

export interface TApplyIngestContractInput {
  /** The raw bag: URL params, an SDK call, or a whole `response.data` at a server boundary. */
  incoming: Readonly<Record<string, unknown>>;
  /** The survey's `ingested` fields — the allow-list. Read from the inlined rows (ENG-1837/2412). */
  ingestedFields: readonly TLinkedEmbeddedField[];
  /**
   * Every question's element id. Required rather than optional: `response.data` is one flat map
   * shared with question answers, so a contract that does not know the answer keys either eats them
   * or lets an ingested value overwrite one. An empty array is a claim, not a default.
   */
  elementIds: readonly string[];
  /**
   * Whether to actually cut a value that exceeds {@link MAX_INGESTED_VALUE_BYTES}. Defaults to
   * `true`, so a caller that forgets is still bounded.
   *
   * The renderer passes `false`, and that is a correctness requirement rather than a preference.
   * Truncation is the one rule whose enforcement destroys the evidence that it happened: every other
   * verdict is re-derivable from the stored value — a `coercion_failed` is re-derived because the raw
   * text was kept — but a value that has already been cut *fits* the budget, so the server's re-run
   * produces no `truncated` flag and a cut value becomes indistinguishable from a complete one. Only
   * the boundary that still sees the real length can both cut and record it, and that is the boundary
   * that writes.
   *
   * The flag is raised either way, so the renderer still warns about a value it is not itself
   * cutting — it is describing what the server will store.
   */
  enforceSizeLimit?: boolean;
}

/** What one value can arrive as and still be storable. Anything else is `unsupported_value`. */
type TIngestableScalar = string | number | boolean | Date;

const TRUE_TOKENS: ReadonlySet<string> = new Set(["true", "1", "yes", "on"]);
const FALSE_TOKENS: ReadonlySet<string> = new Set(["false", "0", "no", "off"]);

/**
 * An ISO 8601 datetime, with the zone designator optional and a space tolerated in place of the `T`
 * — both spellings turn up in query strings. Captured in three parts so the zone can be supplied
 * rather than guessed; see {@link normalizeDate}.
 */
const ISO_DATETIME_REGEX =
  /^(\d{4}-\d{2}-\d{2})[Tt ](\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)([Zz]|[+-]\d{2}:?\d{2})?$/;

/**
 * UTF-8 byte length of one code point, computed rather than encoded — truncation walks every code
 * point of an oversize value, and allocating a `TextEncoder` result per step is a lot of garbage to
 * produce for an arithmetic answer. Lone surrogates encode as U+FFFD, which is also 3 bytes, so the
 * `< 0x10000` arm covers them.
 */
const utf8SizeOfCodePoint = (codePoint: number): number => {
  if (codePoint < 0x80) return 1;
  if (codePoint < 0x800) return 2;
  if (codePoint < 0x10000) return 3;
  return 4;
};

/**
 * Cuts `value` to at most `maxBytes` UTF-8 bytes on a code-point boundary, returning it unchanged
 * when it already fits — so the caller can flag a truncation by identity rather than re-measuring.
 *
 * Code points, not `.length` and not a naive `slice`: slicing UTF-16 units splits a surrogate pair
 * and leaves a lone half, which is a value no consumer can render and, in a `Json` column, one
 * PostgreSQL will not even accept. Grapheme clusters can still be split — an emoji ZWJ sequence may
 * lose its tail — which is the accepted cost of a byte budget.
 */
const truncateToMaxUtf8Bytes = (value: string, maxBytes: number): string => {
  let bytes = 0;
  let keptUnits = 0;

  // Iterating a string yields code points, so a surrogate pair arrives as one two-unit character.
  for (const character of value) {
    const size = utf8SizeOfCodePoint(character.codePointAt(0) ?? 0);
    if (bytes + size > maxBytes) return value.slice(0, keptUnits);
    bytes += size;
    keptUnits += character.length;
  }

  return value;
};

/**
 * True when `raw` is already a legal `TResponseDataValue`. Used for the keys the contract does not
 * own — question answers — so they can pass through without a cast that would let a malformed shape
 * into the column on the word of the caller's type.
 */
const isResponseDataValue = (raw: unknown): raw is NonNullable<TResponseDataValue> => {
  if (typeof raw === "string") return true;
  // Non-finite numbers are not JSON: `JSON.stringify(Infinity)` is `null`, so storing one loses it.
  if (typeof raw === "number") return Number.isFinite(raw);
  if (Array.isArray(raw)) return raw.every((entry) => typeof entry === "string");
  // Plain objects only. `Object.values(new Date())` is `[]` and `[].every(...)` is `true`, so a
  // prototype check is what stops a `Date`, `Map`, `Set` or any class instance without own
  // enumerable string properties from passing the arm below — which is the exact shape this guard
  // exists to keep out of a `Json` column.
  if (typeof raw === "object" && raw !== null && Object.getPrototypeOf(raw) === Object.prototype) {
    return Object.values(raw).every((entry) => typeof entry === "string");
  }
  return false;
};

const toIngestableScalar = (raw: unknown): TIngestableScalar | undefined => {
  if (typeof raw === "string" || typeof raw === "number" || typeof raw === "boolean") return raw;
  // An invalid `Date` carries no value to keep, so it is dropped rather than stringified into the
  // literal "Invalid Date".
  if (raw instanceof Date) return Number.isNaN(raw.getTime()) ? undefined : raw;
  return undefined;
};

/** The one storable spelling of a value that failed to coerce: what arrived, as text. */
const stringifyScalar = (scalar: TIngestableScalar): string =>
  scalar instanceof Date ? scalar.toISOString() : String(scalar);

/**
 * Canonicalizes the zone designator into the one spelling `Date` is specified to parse.
 *
 * `±HHMM` reaches here because query strings carry it, and V8 happens to accept it — but it is not
 * in ECMAScript's Date Time String Format, so parsing it is implementation-defined. Left alone, the
 * same param would resolve to an instant on the server and flag as uncoercible in an engine that
 * refuses it, which is exactly the cross-runtime disagreement {@link normalizeDate} exists to
 * prevent. An absent designator means UTC, for the reason given there.
 */
const normalizeZoneDesignator = (zone: string | undefined): string => {
  if (zone === undefined || zone.toLowerCase() === "z") return "Z";
  return zone.includes(":") ? zone : `${zone.slice(0, 3)}:${zone.slice(3)}`;
};

const normalizeNumber = (scalar: TIngestableScalar): number | undefined => {
  if (typeof scalar === "number") return Number.isFinite(scalar) ? scalar : undefined;
  // `Number(true)` is 1 and `Number(someDate)` is an epoch, but neither is a number anyone meant to
  // send to a number field, so both are flagged rather than silently accepted.
  if (typeof scalar !== "string") return undefined;

  const trimmed = scalar.trim();
  // Never `0`: `Number("") === 0` is a coercion artifact, not data. The read seam agrees.
  if (trimmed === "") return undefined;

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
};

/**
 * Normalizes the spellings a boolean arrives in — `1/0`, `yes/no`, `on/off` — into the two the read
 * seam accepts.
 *
 * **The stored form is the string `"true"` / `"false"`, not a boolean.** `ZResponseDataValue` has no
 * boolean member (`string | number | string[] | Record<string, string>`), so there is nowhere in
 * `response.data` for a real boolean to live; `coerceToEmbeddedDataType` reads exactly these two
 * strings back into one. Widening the read seam instead was rejected: it would make every consumer
 * of `response.data` — exports, filters, the summary, the response table — handle a fourth value
 * shape, for a field whose two states already have a lossless text spelling.
 */
const normalizeBoolean = (scalar: TIngestableScalar): "true" | "false" | undefined => {
  if (typeof scalar === "boolean") return scalar ? "true" : "false";
  if (typeof scalar === "number") {
    if (scalar === 1) return "true";
    if (scalar === 0) return "false";
    return undefined;
  }
  if (typeof scalar !== "string") return undefined;

  const token = scalar.trim().toLowerCase();
  if (TRUE_TOKENS.has(token)) return "true";
  if (FALSE_TOKENS.has(token)) return "false";
  return undefined;
};

/**
 * Normalizes a date into the subset the read seam pins: an ISO 8601 date (`2026-08-06`) or a UTC
 * datetime (`2026-08-06T10:30:00.000Z`).
 *
 * Two rules worth stating out loud:
 *
 * - **A value the read seam already accepts is returned untouched.** That keeps a date-only value a
 *   date rather than promoting it to midnight UTC — `?signup=2026-08-06` says nothing about a time,
 *   and inventing one would make the value answer questions it was never asked — and it keeps
 *   normalization exactly idempotent, so the server re-running the contract cannot rewrite what the
 *   renderer already normalized. It is also what rejects a date that does not exist: `2026-02-30`
 *   fails `z.iso.date()` and is flagged rather than rolled forward to March 2nd.
 * - **A datetime with no zone is read as UTC, never as the local zone of whoever ran the contract.**
 *   `new Date("2026-08-06T10:30:00")` is local time per ES2015, so parsing it that way would ingest
 *   the same param as two different instants depending on the browser's zone — and then have the
 *   server's re-validation disagree with the renderer. Supplying `Z` keeps the wall clock the caller
 *   wrote and makes the result the same everywhere.
 *
 * An explicit offset (`+02:00`) is honest about its instant, so it is converted to UTC. Free-form
 * strings (`"Aug 6, 2026"`) and epoch numbers are refused: `Date` parses both in
 * implementation-defined ways, and an ambiguous seconds-or-milliseconds guess is worse than a flag.
 */
const normalizeDate = (scalar: TIngestableScalar): string | undefined => {
  if (scalar instanceof Date) return scalar.toISOString();
  if (typeof scalar !== "string") return undefined;

  const trimmed = scalar.trim();
  if (coerceToEmbeddedDataType(trimmed, "date") !== undefined) return trimmed;

  const parts = ISO_DATETIME_REGEX.exec(trimmed);
  if (!parts) return undefined;

  const [, datePart, timePart, zonePart] = parts;
  const instant = new Date(`${datePart}T${timePart}${normalizeZoneDesignator(zonePart)}`);
  return Number.isNaN(instant.getTime()) ? undefined : instant.toISOString();
};

const normalizeScalar = (
  scalar: TIngestableScalar,
  dataType: TEmbeddedDataType
): TResponseDataValue | undefined => {
  switch (dataType) {
    case "string":
      // Every scalar has a lossless text form, so a string field never fails to coerce. `""` is kept:
      // an ingested empty string is a present value, and what to display instead is the consumer's
      // fallback logic rather than a data semantic.
      return typeof scalar === "string" ? scalar : stringifyScalar(scalar);
    case "number":
      return normalizeNumber(scalar);
    case "boolean":
      return normalizeBoolean(scalar);
    case "date":
      return normalizeDate(scalar);
  }
};

/**
 * Normalizes one incoming value against one field's `dataType` (rule 4: coerce, don't reject).
 *
 * Returns `undefined` only when nothing storable arrived — `null`, `undefined`, or a non-scalar.
 * Otherwise the value is always stored: either in its canonical form, or verbatim with
 * `coercion_failed`, so a wrong-typed param can never be the reason a response fails to save.
 *
 * **The accepted form is checked against the read seam, not against a second copy of its rules.**
 * `coerceToEmbeddedDataType` is narrower than a permissive reading of rule 4 in three places
 * (booleans are only `"true"`/`"false"`; dates are `Z`-only with no surrounding whitespace; a
 * non-numeric number resolves to `defaultValue`), and validating through it is what makes write/read
 * drift unrepresentable rather than review-dependent: a value that would ingest "successfully" and
 * then resolve as unset comes back flagged instead.
 */
export const normalizeIngestedValue = (
  raw: unknown,
  dataType: TEmbeddedDataType
): TNormalizedIngestValue | undefined => {
  const scalar = toIngestableScalar(raw);
  if (scalar === undefined) return undefined;

  const candidate = normalizeScalar(scalar, dataType);
  if (candidate !== undefined && coerceToEmbeddedDataType(candidate, dataType) !== undefined) {
    return { value: candidate };
  }

  return { value: stringifyScalar(scalar), flag: "coercion_failed" };
};

/**
 * Applies the whole contract to one incoming bag: allow-list → `locked` → coerce → size limit.
 *
 * Nothing here is fatal. Every key either becomes a stored value, is reported in `dropped`, or —
 * when it is a question answer — passes through untouched.
 *
 * Two things it deliberately does **not** do:
 *
 * - **It never writes `defaultValue`** (rule 8). `resolveEmbeddedValue` already falls back to it on
 *   read, and two writers would mean a later change to a default applies on one path and not the
 *   other. A field nothing arrived for keeps its key omitted, exactly like an absent hidden field
 *   today.
 * - **It has no opinion on the empty string.** `""` is a present value here, and whether an *absent*
 *   param should count as one belongs to the adapter: the URL path drops empties, because `?plan=`
 *   must not clear a value, while `setEmbeddedData("", …)` is a deliberate write (ENG-1844 uses
 *   `null` for removal). Asymmetric on purpose, and the asymmetry lives at the two call sites rather
 *   than as a mode flag here.
 */
export const applyIngestContract = ({
  incoming,
  ingestedFields,
  elementIds,
  enforceSizeLimit = true,
}: TApplyIngestContractInput): TIngestResult => {
  // Null-prototype, because `storageKey` and element ids only have to satisfy `isLegacyIdCharset`,
  // which admits `__proto__`. On a plain `{}` that key hits `Object.prototype`'s setter, silently
  // discards a string, and leaves no own property — the one outcome this function promises cannot
  // happen: no stored value, no drop, no flag. Spread back into a literal on return so callers get an
  // ordinary object (spread copies own properties without invoking setters, so the key survives).
  const data: TResponseData = Object.create(null);
  const flags: TIngestFlag[] = [];
  const dropped: TIngestDrop[] = [];

  const elementIdSet = new Set(elementIds);
  const incomingKeys = Object.keys(incoming);

  // A question answer is not ingestable input. Excluding these keys from the match below is what
  // stops `?plan=x` from being rerouted onto a declared `Plan` when `plan` is an element id — the
  // case-insensitive rule must not become a way to rewrite an answer under another name.
  const ingestableKeys = incomingKeys.filter((key) => !elementIdSet.has(key));

  for (const key of incomingKeys) {
    if (!elementIdSet.has(key)) continue;
    const answer = incoming[key];
    // Reported rather than silently omitted: an answer this shape cannot be stored either, and a
    // caller that sent one deserves to hear about it on the same channel as everything else.
    if (isResponseDataValue(answer)) data[key] = answer;
    else dropped.push({ key, reason: "unsupported_value" });
  }

  const consumedKeys = new Set<string>();

  for (const { field, link } of ingestedFields) {
    const { storageKey } = link;

    // Rule 2, enforced here rather than trusted from the caller: `computed` fields are written by
    // survey logic and `reserved` ones are read-only, so neither is addressable from outside. A
    // caller that forgot to filter its field list therefore cannot widen what is settable.
    if (field.source !== "ingested") continue;

    // A question answer owns this address, and an answer is never rewritten — so this field can
    // never hold a value. Reported only when something actually arrived for it, so a survey stuck
    // with a colliding name does not log a line per response for a value nobody sent.
    if (elementIdSet.has(storageKey)) {
      const collidingKey = matchDeclaredFieldName(incomingKeys, storageKey);
      if (collidingKey !== undefined) {
        // Consumed, so the collision is reported once rather than also as an unknown key.
        consumedKeys.add(collidingKey);
        dropped.push({ key: storageKey, reason: "element_id_collision" });
      }
      continue;
    }

    // Resolved declared-side, against the incoming keys, so an exactly matching key always beats a
    // case-insensitive one whatever order the bag arrived in — and so one param can fill two fields
    // that differ only by case, which `@@unique([surveyId, storageKey])` allows and the shipped URL
    // reader already does. Case tolerance is not optional: surveys relying on that drift are
    // collecting data today.
    const matchedKey = matchDeclaredFieldName(ingestableKeys, storageKey);
    // Rule 8: nothing arrived, so the key stays omitted rather than being written as a default.
    if (matchedKey === undefined) continue;
    consumedKeys.add(matchedKey);

    // Both drops below report `storageKey` rather than the `matchedKey` they came in under, so a
    // field declared `Plan` and sent as `plan` is greppable by the name the survey declares — see
    // {@link TIngestDrop.key}.
    if (field.locked) {
      dropped.push({ key: storageKey, reason: "locked_field" });
      continue;
    }

    const normalized = normalizeIngestedValue(incoming[matchedKey], field.dataType);
    if (normalized === undefined) {
      dropped.push({ key: storageKey, reason: "unsupported_value" });
      continue;
    }

    if (normalized.flag) flags.push({ key: storageKey, reason: normalized.flag });

    if (typeof normalized.value === "string") {
      const truncated = truncateToMaxUtf8Bytes(normalized.value, MAX_INGESTED_VALUE_BYTES);
      // Flagged whenever it *would* be cut, but only cut where it is stored — see `enforceSizeLimit`.
      if (truncated !== normalized.value) flags.push({ key: storageKey, reason: "truncated" });
      data[storageKey] = enforceSizeLimit ? truncated : normalized.value;
      continue;
    }

    data[storageKey] = normalized.value;
  }

  for (const key of ingestableKeys) {
    if (!consumedKeys.has(key)) dropped.push({ key, reason: "unknown_key" });
  }

  return { data: { ...data }, flags, dropped };
};

/**
 * Folds a fresh ingest result into the flags a response already carries, for the partial writes a
 * `PUT` makes: a key the payload rewrote takes its new flags — including none at all, so a value
 * corrected on a later block stops being flagged — and every other key keeps what it had, because
 * its stored value is untouched.
 *
 * Keys `dropped` this round are deliberately left alone: nothing was written for them, so whatever
 * their stored value is, the flag that described it still does.
 */
export const mergeIngestFlags = (
  existing: readonly TIngestFlag[],
  result: { data: Readonly<TResponseData>; flags: readonly TIngestFlag[] }
): TIngestFlag[] => {
  const rewrittenKeys = new Set(Object.keys(result.data));
  return [...existing.filter((flag) => !rewrittenKeys.has(flag.key)), ...result.flags];
};
