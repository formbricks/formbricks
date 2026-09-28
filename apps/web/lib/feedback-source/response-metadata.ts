import "server-only";
import { logger } from "@formbricks/logger";
import {
  type TEmbeddedFieldsSurvey,
  type TEmbeddedValueResponse,
  type TLinkedEmbeddedField,
  getComputedEmbeddedFields,
  getIngestedEmbeddedFields,
  resolveEmbeddedValue,
} from "@formbricks/types/embedded-data-resolver";
import type { TResponse } from "@formbricks/types/responses";
import type { TSurvey } from "@formbricks/types/surveys/types";

/**
 * Response- and survey-level context published on every FeedbackRecord's `metadata` (ENG-1554).
 *
 * Records used to carry only the answer itself, so Hub held no dimension to slice a dashboard by —
 * no channel, no device, no completion state. Everything below already existed on the response and
 * was simply dropped on the floor.
 *
 * Two rules govern what may be added here:
 *
 * 1. It is an allowlist, never a spread of `response.meta`. `ipAddress` is the reason: it lives on
 *    the same object, it is personal data under GDPR, and Hub applies no validation or redaction of
 *    its own. A spread would publish it the moment a survey enables IP capture. Absence by
 *    construction is the guard — there is no filter to forget.
 *
 *    The other response fields left out, so a reader can tell decided from forgotten:
 *    `contactAttributes` (arbitrary customer-set values — the richest dimension set here, and the
 *    one most likely to carry personal data, so it needs its own decision rather than riding along),
 *    `tags` (curated in the UI after submission, so at `responseFinished` they are near-always empty
 *    and would publish a stale value), `variables` (never spread flat — per-survey and unbounded;
 *    but the subset a survey *declares* as computed Embedded Data is published under the nested
 *    `embedded_data` key since ENG-3290, see {@link buildEmbeddedDataMetadata}), and `displayId` /
 *    `singleUseId` / `updatedAt` (internal plumbing, and `singleUseId` is itself a link token).
 * 2. Values are bounded here. `source`, `url` and `action` are client-supplied on the public
 *    response endpoint (`ZResponseInput.meta` declares no maximum lengths) and Hub caps only the
 *    total request body at 512 KiB, so an oversized value would fail the create and silently cost
 *    the response its records.
 *
 * The shape below deliberately mirrors `RESERVED_FIELD_CATALOG` on `epic/embedded-data-v1` (a key,
 * a typed reader, a publish decision per field). When that lands, this table becomes a projection
 * of the catalog rather than a second list of the same fields — see ENG-2538, which exists because
 * private copies of that list drifted from it.
 */

/**
 * Metadata values are scalars only, which keeps sanitation total — no recursion, no nested JSON.
 *
 * `null` is in the union because `Response.meta` is a Prisma `Json` column: its Zod type describes
 * what the API writes, not what the table holds, and stored rows are never re-validated on read. A
 * reader can therefore surface a `null` — or a value of the wrong type entirely — where the type
 * says `string | undefined`.
 */
type TMetadataValue = string | number | boolean | null | undefined;

export type TResponseMetadata = Record<string, string | number | boolean>;

/** One response's resolved Embedded Data, keyed by `field.name` — the ENG-3233 labelling rule. */
export type TEmbeddedDataMetadata = Record<string, string | number | boolean>;

/**
 * What one FeedbackRecord's `metadata` carries: the flat response context above, plus the
 * response's Embedded Data under a single nested key (ENG-3290).
 *
 * Nested rather than flattened because field names are author-chosen and unconstrained — a survey
 * declaring a field called `country` or `source` would otherwise overwrite the context key of the
 * same name, and which one won would depend on spread order rather than on anything a reader can
 * see on the record.
 */
export type TRecordMetadata = {
  [key: string]: string | number | boolean | TEmbeddedDataMetadata | undefined;
  embedded_data?: TEmbeddedDataMetadata;
};

export type TMetadataContext = {
  response: Pick<TResponse, "meta" | "finished" | "ttc" | "endingId">;
  survey: Pick<TSurvey, "type">;
};

export type TMetadataFieldSpec = {
  /** snake_case key as it appears in the Hub record's metadata object. */
  readonly key: string;
  /**
   * Whether the field is published. Every field ships enabled; the flag exists so withdrawing one
   * (a privacy decision, a customer request) is a one-word edit to this table rather than a change
   * to the projection below, and so the epic's `privacy: "drop"` verdicts have somewhere to land.
   */
  readonly enabled: boolean;
  /** Overrides MAX_METADATA_TEXT_LENGTH for string values. */
  readonly maxLength?: number;
  readonly read: (context: TMetadataContext) => TMetadataValue;
};

const MAX_METADATA_TEXT_LENGTH = 256;
/** URLs are legitimately longer than other values, even after the query string is stripped. */
const MAX_METADATA_URL_LENGTH = 512;
/**
 * Serialized ceiling for the whole `embedded_data` object — **self-imposed**: nothing on this path
 * would catch the overflow.
 *
 * Truncating each value is no bound on the object, because a survey may declare any number of
 * fields and 256 characters apiece adds up. The only upstream limit the pipeline actually meets is
 * the Hub SDK's 512 KiB request-body cap (`createFeedbackRecordsBatch`), and the metadata object is
 * repeated on every record of the submission, so reaching it would cost the response its records
 * rather than that one field. The v3 route's 32 KiB `metadata` check is a different lane and never
 * runs here, so do not raise this expecting that guard to backstop it.
 */
const MAX_EMBEDDED_DATA_BYTES = 8 * 1024;
/**
 * Per-element `ttc` is clamped to 24h at the response boundary (ENG-1083), but stored rows keep the
 * unbounded schema so historical data still parses — and `_total` sums every element. A duration
 * past a week is noise rather than a measurement, and omitting it beats publishing a number that
 * would skew an average silently.
 */
const MAX_DURATION_SECONDS = 7 * 24 * 60 * 60;
/**
 * A high surrogate as the final UTF-16 code unit — the signature of a cut that split a pair. A
 * complete pair ends on its LOW half, so this matches only the orphaned case.
 */
const TRAILING_HIGH_SURROGATE = /[\uD800-\uDBFF]$/;
/**
 * The personal-link route's token segment (`apps/web/app/c/[jwt]`). Stripping the query is not
 * enough there: the JWT *is* the authorization to answer as that contact, and it sits in the path,
 * so `origin + pathname` would move a live credential into a second datastore. It is also unique
 * per recipient, which would give `url` unbounded cardinality precisely where a dashboard wants a
 * dimension. Keep the route, drop the secret.
 */
const PERSONAL_LINK_TOKEN_PATH = /^(\/c)\/[^/]+/;
/**
 * The same token, for the fallback's input shape. A parsed `pathname` starts at `/`, but a value
 * that never parsed still carries its scheme and authority, so the route has to be matched after
 * them — and only as the FIRST path segment, so an unrelated `/a/c/x` is left alone.
 */
const PERSONAL_LINK_TOKEN_URL = /^((?:[a-z][a-z0-9+.-]*:)?\/\/[^/]*|[^/]*)(\/c)\/[^/]+/i;

/** Userinfo up to the LAST `@` before the path, so `u:p@ss@host` cannot leak `ss`. */
const LEADING_USERINFO = /^((?:[a-z][a-z0-9+.-]*:)?\/\/)?[^/]*@/i;

/**
 * Reduce a URL to origin + path.
 *
 * Query strings on survey URLs carry recovery tokens, verified emails and prefilled answers, so the
 * query is the part that must not leave the product. Anything that is not an absolute http(s) URL
 * still gets cut at the first `?` or `#`: a scheme-less value like `app.example.com/p?token=…`
 * cannot be parsed, and passing it through unchanged would leak exactly what this strips.
 */
export const stripUrlQuery = (rawUrl: string): string | undefined => {
  const trimmed = rawUrl.trim();
  if (!trimmed) return undefined;

  try {
    const parsed = new URL(trimmed);
    // `origin` also drops any embedded credentials (https://user:pass@host).
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return `${parsed.origin}${parsed.pathname.replace(PERSONAL_LINK_TOKEN_PATH, "$1")}`;
    }
  } catch {
    // Not an absolute URL — fall through to the textual cut below.
  }

  // The origin branch never ran, so credentials have not been dropped — and this path is easy to
  // reach with them: `user:pass@host/p` parses as a URL whose protocol is `user:`, and the
  // protocol-relative `//user:pass@host/p` cannot be parsed without a base, so both skip the
  // branch above. Cut the query first, then remove any userinfo, keeping a `scheme://` or bare
  // `//` prefix when one is present.
  const cut = trimmed
    .split(/[?#]/)[0]
    .replace(LEADING_USERINFO, "$1")
    .replace(PERSONAL_LINK_TOKEN_URL, "$1$2")
    .trim();

  return cut || undefined;
};

const readDurationSeconds = (ttc: TResponse["ttc"]): number | undefined => {
  const total = ttc?._total;
  if (typeof total !== "number" || !Number.isFinite(total) || total < 0) return undefined;

  const seconds = Math.round(total / 1000);
  return seconds <= MAX_DURATION_SECONDS ? seconds : undefined;
};

/**
 * The published field set. `ipAddress` is absent deliberately and must stay absent — see rule 1 in
 * the module comment. Readers are optional-chained throughout: stored rows predate several of these
 * fields, and `meta` defaults to `{}` in Prisma.
 */
export const HUB_METADATA_FIELDS: readonly TMetadataFieldSpec[] = [
  { key: "source", enabled: true, read: ({ response }) => response.meta?.source },
  {
    key: "url",
    enabled: true,
    maxLength: MAX_METADATA_URL_LENGTH,
    read: ({ response }) => {
      const url = response.meta?.url;
      return typeof url === "string" ? stripUrlQuery(url) : undefined;
    },
  },
  { key: "browser", enabled: true, read: ({ response }) => response.meta?.userAgent?.browser },
  { key: "os", enabled: true, read: ({ response }) => response.meta?.userAgent?.os },
  { key: "device", enabled: true, read: ({ response }) => response.meta?.userAgent?.device },
  { key: "country", enabled: true, read: ({ response }) => response.meta?.country },
  { key: "action", enabled: true, read: ({ response }) => response.meta?.action },
  {
    key: "finished",
    enabled: true,
    read: ({ response }) => (typeof response.finished === "boolean" ? response.finished : undefined),
  },
  { key: "duration_seconds", enabled: true, read: ({ response }) => readDurationSeconds(response.ttc) },
  // Which ending the respondent reached — the branch they came out of. Bounded per survey and
  // author-defined, so it groups cleanly.
  { key: "ending_id", enabled: true, read: ({ response }) => response.endingId },
  { key: "survey_type", enabled: true, read: ({ survey }) => survey.type },
];

/**
 * Narrow one read value to something Hub can store, or drop it.
 *
 * Takes `unknown` rather than TMetadataValue on purpose: the readers are typed against
 * `TResponseMeta`, which describes what the API writes into a `Json` column rather than what the
 * column holds. A throw here is not a local failure — it aborts the whole transform, and the
 * caller's catch turns that into a response whose records are silently never published.
 */
const sanitizeValue = (value: unknown, maxLength: number): string | number | boolean | undefined => {
  if (value === undefined || typeof value === "boolean") return value;

  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;

  // Catches a stored null (typeof null === "object") as well as an object or array, neither of
  // which the scalar-only metadata contract can carry.
  if (typeof value !== "string") return undefined;

  // NUL bytes are the one input Hub cannot store: its validator skips non-string kinds, so the
  // jsonb insert reaches Postgres and fails as a 500 rather than a rejected field.
  const cleaned = value.replaceAll("\u0000", "").trim();
  if (!cleaned) return undefined;
  if (cleaned.length <= maxLength) return cleaned;

  // maxLength counts UTF-16 code units, so the cut can land between the halves of a surrogate
  // pair — and a lone surrogate is rejected on the jsonb insert exactly like a NUL byte, with the
  // same silently-dropped-records outcome. The caller picks the offset by choosing the value's
  // length, so this is reachable on purpose and not only by accident.
  const truncated = cleaned.slice(0, maxLength);
  const whole = TRAILING_HIGH_SURROGATE.test(truncated) ? truncated.slice(0, -1) : truncated;

  // The cut can land mid-word and leave trailing space the pre-truncation trim never saw.
  return whole.trimEnd() || undefined;
};

/**
 * Read a field table into a flat metadata object, dropping every value that is absent, empty or
 * unrepresentable.
 *
 * Separate from the table so the mechanism can be proven against an arbitrary table — a disabled
 * field, a field with its own maxLength — without mutating the module-level catalog other callers
 * share.
 */
export const projectMetadataFields = (
  fields: readonly TMetadataFieldSpec[],
  context: TMetadataContext
): TResponseMetadata => {
  const metadata: TResponseMetadata = {};

  for (const field of fields) {
    if (!field.enabled) continue;

    const value = sanitizeValue(field.read(context), field.maxLength ?? MAX_METADATA_TEXT_LENGTH);
    if (value !== undefined) metadata[field.key] = value;
  }

  return metadata;
};

/**
 * Build the metadata object shared by every FeedbackRecord of one response.
 *
 * Called once per response, not per record: the result is spread into each record by
 * `buildBaseFields`, so a submission's records agree on their context by construction.
 */
export const buildResponseMetadata = (
  response: TMetadataContext["response"],
  survey: TMetadataContext["survey"]
): TResponseMetadata => projectMetadataFields(HUB_METADATA_FIELDS, { response, survey });

/**
 * Build the `embedded_data` object shared by every FeedbackRecord of one response (ENG-3290).
 *
 * Ingested and computed fields only, since a record already carries the reserved catalog's entries
 * by other routes and repeating one here would give a dimension two answers. Nine are published
 * flat by {@link HUB_METADATA_FIELDS} (`source`, `url`, `country`, `action`, `browser`, `os`,
 * `deviceType`, `finished`, `durationSeconds`), and four ride on the record itself as first-class
 * columns rather than in `metadata` at all — `responseId` as `submission_id`, `surveyId` as
 * `source_id`, `startedAt` as `collected_at`, and `language` (`buildBaseFields` in ./transform).
 *
 * What no route publishes: `ipAddress`, by the decision in rule 1 above; `finishedAt`; and the
 * ENG-1841 browser-runtime entries (`utm*`, `pagePath`, `pageReferrer`, `timezone`, `locale`, the
 * screen and viewport sizes), because widening the allowlist is its own privacy decision. Their
 * absence is scope, not duplication.
 *
 * Values come from {@link resolveEmbeddedValue}, so `locked`, `defaultValue` and the coercion rules
 * are the ones recall, logic and export already apply — a locked field publishes its default rather
 * than whatever a crafted URL supplied, and a value that cannot honestly represent its `dataType` is
 * omitted instead of published as text. A survey still on the legacy columns needs no branch here:
 * its fields are inlined from them at load (`inlineSurveyEmbeddedFields`).
 *
 * Rule 2 of the module comment governs this object too, and both the value bound and the object
 * bound are applied per field rather than by abandoning the rest: a field that overflows the budget
 * or whose read throws costs only itself. `response.data` and `response.variables` are `Json`
 * columns whose stored rows are never re-validated on read, so a `null` where the type says object
 * throws here — and an uncaught throw would abort the whole transform, which is how a response
 * loses every one of its records.
 */
export const buildEmbeddedDataMetadata = (
  response: TEmbeddedValueResponse,
  survey: TEmbeddedFieldsSurvey
): TEmbeddedDataMetadata => {
  const logContext = { surveyId: response.surveyId, responseId: response.id };

  let fields: TLinkedEmbeddedField[];
  try {
    fields = [...getIngestedEmbeddedFields(survey), ...getComputedEmbeddedFields(survey)];
  } catch (error) {
    logger.warn({ err: error, ...logContext }, "Failed to read a survey's Embedded Data fields");
    return {};
  }

  // A Map, read back through Object.fromEntries, so no field name can reach an object literal's
  // prototype setter while the object is built.
  const values = new Map<string, string | number | boolean>();
  // Names are claimed before their value is read. Checking `values` instead would make a clash "the
  // first field with a value wins": an empty ingested field would hand its name to a computed one,
  // and one Hub dimension would mix both sources depending on the response.
  const claimed = new Set<string>();
  let usedBytes = 2; // The enclosing "{}".
  let overBudget = 0;
  let unreadable = 0;
  let unpublishable = 0;
  let firstError: unknown;

  for (const entry of fields) {
    // The whole body, not just the read: `name` is `String NOT NULL` in the table, but a survey on
    // the legacy columns has its pairs synthesized by `deriveLegacyEmbeddedData` from
    // `hiddenFields.fieldIds` and `variables[].name` — `Json` columns the pipeline's select reads
    // without a Zod parse. A stored `fieldIds: [42]` makes `.replaceAll` throw, and outside a guard
    // that throw leaves this function, `buildBaseFields` and the transform, so the response
    // publishes no records to any feedback source at all.
    try {
      const { field, link } = entry;

      // NUL bytes are unstorable in a key for the same reason sanitizeValue strips them from a
      // value: the jsonb insert reaches Postgres and fails as a 500 rather than a rejected field.
      // Trimmed like the values are, so `" brand "` and `"brand"` cannot become two Hub dimensions.
      const key = field.name.replaceAll("\u0000", "").trim();
      // Blank, or `__proto__`. Hub stores that one fine, but React drops an own `__proto__` key when it
      // serializes props, as does any reader that spreads the object or parses it into a plain one, so
      // the record drawer would show one field fewer than the record holds.
      if (!key || key === "__proto__") {
        unpublishable += 1;
        continue;
      }
      // On a name collision the first field to reach here wins. The list is every ingested field
      // followed by every computed one, so ingested beats computed, and within one source the earlier
      // declaration beats the later — whether or not the winner has a value on this response.
      if (claimed.has(key)) continue;
      claimed.add(key);

      const value = sanitizeValue(resolveEmbeddedValue({ field, link }, response), MAX_METADATA_TEXT_LENGTH);
      if (value === undefined) continue;

      // Key, value, the `:` between them and the `,` before the next entry.
      const entryBytes =
        Buffer.byteLength(JSON.stringify(key), "utf8") + Buffer.byteLength(JSON.stringify(value), "utf8") + 2;
      // Skip and keep going rather than stop: `name` has no declared maximum, so one field with a
      // huge name declared first would otherwise silence Embedded Data for that survey entirely —
      // and among ordinary fields, whether a later one published would depend on how much the
      // respondent happened to type into the earlier ones.
      if (usedBytes + entryBytes > MAX_EMBEDDED_DATA_BYTES) {
        overBudget += 1;
        continue;
      }

      usedBytes += entryBytes;
      values.set(key, value);
    } catch (error) {
      // Counted rather than logged per field: one malformed column makes every field of its source
      // throw, and a survey with forty of them would write forty identical lines per response.
      unreadable += 1;
      firstError ??= error;
    }
  }

  // Once per response, not per field: a dropped field is a Hub dimension that exists on some
  // responses and not others, which is invisible downstream unless it is said here.
  if (overBudget > 0) {
    logger.warn(
      { ...logContext, overBudget, published: values.size, maxBytes: MAX_EMBEDDED_DATA_BYTES },
      "Embedded Data fields dropped from FeedbackRecord metadata: object size budget reached"
    );
  }
  if (unreadable > 0) {
    logger.warn(
      { err: firstError, ...logContext, unreadable, published: values.size },
      "Embedded Data fields dropped from FeedbackRecord metadata: field could not be read"
    );
  }
  if (unpublishable > 0) {
    logger.warn(
      { ...logContext, unpublishable, published: values.size },
      "Embedded Data fields dropped from FeedbackRecord metadata: name cannot be published"
    );
  }

  return Object.fromEntries(values);
};
