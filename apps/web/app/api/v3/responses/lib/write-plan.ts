import { applyIngestContract, normalizeIngestedValue } from "@formbricks/types/embedded-data-ingest";
import { RESERVED_FIELD_CATALOG, type TLinkedEmbeddedField } from "@formbricks/types/embedded-data-resolver";
import type { TResponseData, TResponseDataValue, TResponseTtc } from "@formbricks/types/responses";
import type { InvalidParam } from "@/app/api/v3/lib/response";
import { calculateTtcTotal } from "@/lib/response/utils";
import { type TV3AnswerPlan, isPublishableDataKey } from "./answers";

/**
 * Turning a write payload into the two stored maps, without touching the database.
 *
 * Everything here is a pure function of the payload and the survey definition, which is what makes
 * `POST /api/v3/responses/validate` able to report a write's effects without performing it: the
 * validate endpoint runs exactly these planners and discards the plan. Keeping the rules out of the
 * transaction is the point — a rule that lives inside `prisma.$transaction` can only be tested by
 * writing a row.
 *
 * The two maps are `Response.data` and `Response.variables`, and the split is not the one the API
 * shows. A caller sees `data` (answers) and `embeddedData` (fields by name); storage has answers and
 * hidden fields sharing `data`, and variables alone in `variables`. The translation is here.
 */

/** Refusals that need the survey definition to detect, so all of them are 422 rather than 400. */
export type TV3WritePlanIssues = { issues: InvalidParam[] };

export type TV3AnswerDataPlan = TV3WritePlanIssues & { data: TResponseData };

/**
 * Project the caller's `data` onto the stored answer map.
 *
 * **The write predicate is the read projection.** A key is accepted here exactly when the detail
 * view publishes it, because both ask `isPublishableDataKey`. That is the round-trip guarantee in
 * one line: every byte a caller can read back is a byte it can send again, and no byte it cannot
 * read can be written. Getting this wrong in either direction is a real failure — a narrower write
 * rejects what `GET` just handed out, a wider one lets a caller stamp `verifiedEmail` onto someone
 * else's response.
 *
 * `stored` is what makes "replaced wholesale" safe. The contract says an omitted key is removed, and
 * that is honoured for everything the caller can see; the keys it *cannot* see — a hidden field's
 * value, an email-gate `verifiedEmail` — are carried over from `stored` rather than dropped. Without
 * that, the documented round trip (read the detail view, edit one answer, send it back) would
 * silently destroy every hidden-field value on the response, and nothing in the payload would hint
 * that it had. Pass `undefined` on create, where there is nothing to carry over.
 */
export const planAnswerDataWrite = (
  plan: TV3AnswerPlan,
  incoming: Readonly<Record<string, TResponseDataValue>>,
  stored: TResponseData | undefined
): TV3AnswerDataPlan => {
  const issues: InvalidParam[] = [];
  const data: TResponseData = {};

  for (const [key, value] of Object.entries(stored ?? {})) {
    if (!isPublishableDataKey(plan, key)) {
      data[key] = value;
    }
  }

  for (const [key, value] of Object.entries(incoming)) {
    if (isPublishableDataKey(plan, key)) {
      data[key] = value;
      continue;
    }

    // Two reasons a key is unpublishable, and they get different `referenceType`s because a client
    // acts on them differently: a hidden field has a home (`embeddedData`), a system key has none.
    const isHiddenField = plan.ingestedStorageKeys.has(key);

    issues.push({
      name: key,
      reason: isHiddenField
        ? `'${key}' names a hidden field. Write it through 'embeddedData', which addresses fields by name.`
        : `'${key}' is written by the survey runtime and cannot be supplied.`,
      code: "unsupported_field",
      ...(isHiddenField ? { referenceType: "hiddenField" as const } : {}),
    });
  }

  return { data, issues };
};

export type TV3EmbeddedDataPlan = TV3WritePlanIssues & {
  /** Answer-map keys to set — a hidden field is stored in `Response.data` under its storage key. */
  dataWrites: TResponseData;
  /** Answer-map keys to remove, because the payload sent `null` for them. */
  dataClears: string[];
  /** `Response.variables` entries to set, keyed by the variable's cuid. */
  variableWrites: Record<string, TResponseDataValue>;
  variableClears: string[];
};

type TV3EmbeddedDataInput = Readonly<Record<string, string | number | boolean | null>>;

/**
 * Resolve a name-keyed `embeddedData` payload into storage writes.
 *
 * Three things the caller is deliberately not asked to know, each resolved here:
 *
 * 1. **Name, not storage key.** A hidden field is stored under a camelCase storage key and a
 *    variable under a cuid. The read publishes `key` as the field's *name* for both, so the write
 *    takes a name for both and resolves it through the survey's links — otherwise a caller would
 *    have to send back something it was never shown.
 * 2. **Which kind it is.** `ingested` and `computed` land in different columns; the payload says
 *    nothing about which, because the survey already knows.
 * 3. **Omission versus `null`.** Omitted leaves the stored value alone — this map merges, unlike
 *    `data`. `null` clears, which is the only way a merge-shaped map can express deletion at all.
 *
 * Matching is case-insensitive and collisions are refused rather than guessed. A survey predating
 * the reserved-name guard can carry a variable and a hidden field under one name; with no `kind` in
 * the payload, such a name cannot say which field it means, and writing the caller's value into the
 * wrong one is worse than refusing. The set is finite and frozen — nothing new can enter it.
 */
export const planEmbeddedDataWrite = ({
  embeddedFields,
  elementIds,
  incoming,
}: {
  embeddedFields: readonly TLinkedEmbeddedField[];
  elementIds: ReadonlySet<string>;
  incoming: TV3EmbeddedDataInput;
}): TV3EmbeddedDataPlan => {
  const issues: InvalidParam[] = [];
  const dataClears: string[] = [];
  const variableWrites: Record<string, TResponseDataValue> = {};
  const variableClears: string[] = [];
  const ingestedBag: Record<string, string | number | boolean> = {};

  const byName = new Map<string, TLinkedEmbeddedField[]>();
  for (const linked of embeddedFields) {
    const key = linked.field.name.toLowerCase();
    const group = byName.get(key);
    if (group) group.push(linked);
    else byName.set(key, [linked]);
  }

  for (const [name, value] of Object.entries(incoming)) {
    const group = byName.get(name.toLowerCase());

    if (!group) {
      // Checked only after the declared lookup misses, which is the precedence the contract sets: a
      // name matching both a declared field and a catalog entry resolves to the declared one. So
      // reaching here with a catalog hit means the *only* match is auto-captured context.
      const isReserved = RESERVED_FIELD_CATALOG.some(
        (entry) => entry.name.toLowerCase() === name.toLowerCase()
      );

      issues.push({
        name,
        reason: isReserved
          ? `'${name}' is auto-captured context and is not writable. 'source', 'url' and 'action' are accepted under 'meta' on create.`
          : `'${name}' is not an Embedded Data field on this survey.`,
        code: "unsupported_field",
      });
      continue;
    }

    if (group.length > 1) {
      issues.push({
        name,
        reason: `'${name}' matches more than one Embedded Data field on this survey, so it cannot say which one to write. Rename one of them.`,
        code: "duplicate_identifier",
      });
      continue;
    }

    const { field, link } = group[0];

    // A locked field ignores the write rather than refusing it — the same verdict the ingest
    // contract reaches, and it covers the clear as well: `null` on a locked field is still a write.
    if (field.locked) continue;

    if (field.source === "computed") {
      if (value === null) {
        variableClears.push(link.storageKey);
        continue;
      }

      // Stricter than the ingested path below, deliberately. A variable feeds quota evaluation and
      // recall, so a value that cannot honestly represent its declared type would corrupt a
      // downstream calculation rather than just read back oddly — and unlike a hidden field arriving
      // from a URL, this one was typed by a caller who can be told.
      const normalized = normalizeIngestedValue(value, field.dataType);
      if (normalized === undefined || normalized.flag === "coercion_failed") {
        issues.push({
          name,
          reason: `'${name}' is a ${field.dataType} variable and cannot store this value.`,
          code: "unsupported_field",
          referenceType: "variable",
        });
        continue;
      }

      variableWrites[link.storageKey] = normalized.value;
      continue;
    }

    // An answer owns this address and an answer is never rewritten, so the field can never hold a
    // value — which is why the read reports neither the field nor a place to put one. Refused here
    // rather than left to `applyIngestContract`: its answer pass-through would write the value as an
    // answer before its own collision check ever ran.
    if (elementIds.has(link.storageKey)) {
      issues.push({
        name,
        reason: `'${name}' is stored under an id a question already owns on this survey, so it holds the answer rather than a field value.`,
        code: "unsupported_field",
        referenceType: "hiddenField",
      });
      continue;
    }

    if (value === null) {
      dataClears.push(link.storageKey);
      continue;
    }

    ingestedBag[link.storageKey] = value;
  }

  // The same contract the SDK writes through — allow-list, coerce, bound — rather than a second copy
  // of its rules. Named explicitly in the contract for this field ("through the same ingest contract
  // the SDK uses"), so a value that ingests one way from a URL ingests the same way from here.
  const ingested = applyIngestContract({
    incoming: ingestedBag,
    ingestedFields: embeddedFields,
    // The bag is already free of colliding keys, so this array only has to stop the pass-through
    // branch from treating an answer id as an answer — it cannot reach one.
    elementIds: [...elementIds],
  });

  for (const drop of ingested.dropped) {
    // `locked_field` is filtered above and `element_id_collision` cannot be reached, so anything
    // arriving here is a value shape the ingest contract cannot store at all.
    if (drop.reason === "locked_field" || drop.reason === "element_id_collision") continue;

    issues.push({
      name: drop.key,
      reason: `'${drop.key}' cannot be stored as an Embedded Data value.`,
      code: "unsupported_field",
    });
  }

  // `flags` are deliberately not issues. A `coercion_failed` or `truncated` value *is* stored, and
  // the read reports it — turning it into a 422 here would make v3 refuse payloads the SDK accepts
  // for the same field, which is the drift the shared contract exists to prevent.
  return { dataWrites: ingested.data, dataClears, variableWrites, variableClears, issues };
};

/**
 * Resolve the survey language a response will be stamped with, or say why it cannot be.
 *
 * **It returns the survey's own declared code rather than a canonicalized form of the caller's.**
 * That is the whole point of the function, and it is not cosmetic: `normalizeResponseLanguage`
 * expands `de` to `de-DE`, while `resolveV3LabelContext` matches a response against the survey's
 * language set by exact (case-insensitive) code. A survey declaring `de` and a response stored as
 * `de-DE` therefore do not match, the read falls back to the survey default, and every label on a
 * German response comes back in English. Validating against one value and storing another is what
 * creates that gap, so the value that was validated is the value that gets stored.
 *
 * Stricter than the read's `resolveV3LabelContext`, and deliberately so: that one falls back to the
 * default rather than failing, because a response collected before a language was removed still has
 * to serialize. A *write* has no such history to respect — a caller naming a language the survey
 * does not offer has made a mistake, and silently storing the default would attribute the response
 * to the wrong language forever.
 *
 * `enabled` is consulted here for the same reason it is ignored on the read: it says whether an
 * author still accepts submissions in that language, which is exactly the question a new write asks.
 *
 * The literal `"default"` is accepted and passes through. It is what the storage layer writes for a
 * response in the survey's default language, so the read publishes it, and refusing it would break
 * the round trip on a value this API itself handed out.
 */
export const resolveV3WriteLanguage = (
  languages: readonly { default: boolean; enabled: boolean; language: { code: string } }[],
  language: string | null | undefined
): { ok: true; code: string | null } | { ok: false; issue: InvalidParam } => {
  if (language === null || language === undefined) return { ok: true, code: null };
  if (language === "default") return { ok: true, code: "default" };

  const matched = languages.find(
    (entry) =>
      entry.language.code.toLowerCase() === language.toLowerCase() && (entry.enabled || entry.default)
  );

  if (matched) return { ok: true, code: matched.language.code };

  return {
    ok: false,
    issue: {
      name: "language",
      reason: `'${language}' is not a language enabled on this survey.`,
      code: "unsupported_locale",
      referenceType: "language",
    },
  };
};

/** The ending card a response claims to have reached. Must exist in the survey's current definition. */
export const validateV3EndingId = (
  endings: readonly unknown[],
  endingId: string | null | undefined
): InvalidParam | null => {
  if (endingId === null || endingId === undefined) return null;

  const exists = endings.some(
    (ending) => typeof ending === "object" && ending !== null && (ending as { id?: unknown }).id === endingId
  );

  if (exists) return null;

  return {
    name: "endingId",
    reason: `'${endingId}' is not an ending of this survey.`,
    code: "invalid_reference",
    referenceType: "ending",
    missingId: endingId,
  };
};

/** Milliseconds in a day: the contract's upper bound for one element's time-to-complete. */
const TTC_MAX_MS = 86_400_000;

/**
 * The bucket the server owns. A caller-supplied `_total` is dropped rather than trusted: it is
 * derived, so honouring one would let a caller disagree with the sum of its own buckets, and
 * `calculateTtcTotal` would then add it into the total a second time.
 */
const TTC_TOTAL_KEY = "_total";

/**
 * Clamp rather than reject, which is the contract's choice and worth restating: `ttc` is client
 * telemetry, and a single absurd bucket from a laptop that slept mid-survey should not cost a caller
 * the whole response. The total is computed here only on a finished response, matching every other
 * write path.
 */
export const normalizeV3Ttc = (
  ttc: Readonly<Record<string, number>> | undefined,
  finished: boolean
): TResponseTtc => {
  const clamped: TResponseTtc = {};

  for (const [key, value] of Object.entries(ttc ?? {})) {
    if (key === TTC_TOTAL_KEY) continue;
    clamped[key] = Math.min(Math.max(value, 0), TTC_MAX_MS);
  }

  return finished ? calculateTtcTotal(clamped) : clamped;
};
