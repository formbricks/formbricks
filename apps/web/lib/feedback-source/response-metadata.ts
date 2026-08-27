import "server-only";
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

export type TMetadataContext = {
  response: Pick<TResponse, "meta" | "finished" | "ttc">;
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
 * Per-element `ttc` is clamped to 24h at the response boundary (ENG-1083), but stored rows keep the
 * unbounded schema so historical data still parses — and `_total` sums every element. A duration
 * past a week is noise rather than a measurement, and omitting it beats publishing a number that
 * would skew an average silently.
 */
const MAX_DURATION_SECONDS = 7 * 24 * 60 * 60;

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
      return `${parsed.origin}${parsed.pathname}`;
    }
  } catch {
    // Not an absolute URL — fall through to the textual cut below.
  }

  return trimmed.split(/[?#]/)[0] || undefined;
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
  const lastUnit = truncated.charCodeAt(truncated.length - 1);
  const endsOnHighSurrogate = lastUnit >= 0xd800 && lastUnit <= 0xdbff;

  return endsOnHighSurrogate ? truncated.slice(0, -1) : truncated;
};

/**
 * Read a field table into a flat metadata object, dropping every value that is absent, empty or
 * unrepresentable.
 *
 * Separate from the table so the mechanism can be proven against an arbitrary table — a disabled
 * field, a field that throws — without mutating the module-level catalog other callers share.
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
