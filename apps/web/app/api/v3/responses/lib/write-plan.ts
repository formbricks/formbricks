import { normalizeLanguageCode } from "@formbricks/i18n-utils/canonical";
import { applyIngestContract, normalizeIngestedValue } from "@formbricks/types/embedded-data-ingest";
import { RESERVED_FIELD_CATALOG, type TLinkedEmbeddedField } from "@formbricks/types/embedded-data-resolver";
import type { TResponseData, TResponseDataValue, TResponseTtc } from "@formbricks/types/responses";
import type { InvalidParam } from "@/app/api/v3/lib/response";
import { calculateTtcTotal } from "@/lib/response/utils";
import { type TV3AnswerPlan, isPublishableDataKey } from "./answers";

/** Milliseconds in a day: the contract's upper bound for one element's time-to-complete. */
const TTC_MAX_MS = 86_400_000;

/**
 * The bucket the server owns. A caller-supplied `_total` is dropped rather than trusted: it is
 * derived, so honouring one would let a caller disagree with the sum of its own buckets, and
 * `calculateTtcTotal` would then add it into the total a second time.
 */
const TTC_TOTAL_KEY = "_total";

const clampTtcBuckets = (ttc: Readonly<Record<string, number>>): TResponseTtc => {
  const clamped: TResponseTtc = {};

  for (const [key, value] of Object.entries(ttc)) {
    if (key === TTC_TOTAL_KEY) continue;
    clamped[key] = Math.min(Math.max(value, 0), TTC_MAX_MS);
  }

  return clamped;
};

/**
 * Clamp rather than reject, which is the contract's choice and worth restating: `ttc` is client
 * telemetry, and a single absurd bucket from a laptop that slept mid-survey should not cost a caller
 * the whole response.
 *
 * **An omitted `ttc` stores `{}`, never `{_total: 0}`.** Every other write path treats a missing map
 * as "no timing was collected" and stores an empty object; totalling an absent map instead publishes
 * a `durationSeconds` of zero, which reads as "answered instantly" rather than "not measured". A
 * supplied-but-empty map is still totalled, because that is what the other paths do with it.
 */
export const normalizeV3Ttc = (
  ttc: Readonly<Record<string, number>> | undefined,
  finished: boolean
): TResponseTtc => {
  if (ttc === undefined) return {};

  const clamped = clampTtcBuckets(ttc);

  return finished ? calculateTtcTotal(clamped) : clamped;
};

/**
 * Total a `ttc` map that is already in storage, for a patch that finishes the response.
 *
 * `ttc` is create-only for a *caller*, but `_total` is derived rather than supplied, and the shared
 * update service computes it on any write that finishes a response
 * (`lib/response/service.ts`). Without this a response created partial and finished through `PATCH`
 * carries per-element timings and no total, so it reports no duration at all — which no other write
 * path does.
 */
export const totalStoredV3Ttc = (stored: Readonly<Record<string, unknown>> | undefined): TResponseTtc => {
  if (!stored) return {};

  const buckets: Record<string, number> = {};
  for (const [key, value] of Object.entries(stored)) {
    if (key === TTC_TOTAL_KEY) continue;
    if (typeof value === "number" && Number.isFinite(value)) buckets[key] = value;
  }

  return calculateTtcTotal(clampTtcBuckets(buckets));
};

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
 * Index the survey's declared fields by lower-cased name, keeping collisions as a group so
 * {@link matchDeclaredField} can refuse them rather than silently taking the first.
 */
const indexFieldsByName = (
  embeddedFields: readonly TLinkedEmbeddedField[]
): Map<string, TLinkedEmbeddedField[]> => {
  const byName = new Map<string, TLinkedEmbeddedField[]>();

  for (const linked of embeddedFields) {
    const key = linked.field.name.toLowerCase();
    const group = byName.get(key);
    if (group) group.push(linked);
    else byName.set(key, [linked]);
  }

  return byName;
};

/**
 * Turn the ingest contract's drops into issues, minus the two this planner already handled.
 *
 * `locked_field` is filtered before the contract runs and `element_id_collision` is refused there
 * too, so anything left is a value shape the contract cannot store at all.
 *
 * `flags` are deliberately not issues. A `coercion_failed` or `truncated` value *is* stored, and the
 * read reports it — turning one into a 422 here would make v3 refuse payloads the SDK accepts for
 * the same field, which is the drift the shared contract exists to prevent.
 */
const ingestDropIssues = (dropped: readonly { key: string; reason: string }[]): InvalidParam[] =>
  dropped
    .filter((drop) => drop.reason !== "locked_field" && drop.reason !== "element_id_collision")
    .map((drop) => ({
      name: drop.key,
      reason: `'${drop.key}' cannot be stored as an Embedded Data value.`,
      code: "unsupported_field" as const,
    }));

/**
 * Match one payload name to exactly one declared field, or say why it cannot be matched.
 *
 * Case-insensitive, and collisions are refused rather than guessed: a survey predating the
 * reserved-name guard can carry a variable and a hidden field under one name, and with no `kind` in
 * the payload such a name cannot say which field it means. Writing the caller's value into the wrong
 * one is worse than refusing. The set is finite, frozen and tracked — nothing new can enter it.
 */
const matchDeclaredField = (
  byName: ReadonlyMap<string, TLinkedEmbeddedField[]>,
  name: string
): { ok: true; linked: TLinkedEmbeddedField } | { ok: false; issue: InvalidParam } => {
  const group = byName.get(name.toLowerCase());

  if (!group) {
    // Checked only after the declared lookup misses, which is the precedence the contract sets: a
    // name matching both a declared field and a catalog entry resolves to the declared one. So
    // reaching here with a catalog hit means the *only* match is auto-captured context.
    const isReserved = RESERVED_FIELD_CATALOG.some(
      (entry) => entry.name.toLowerCase() === name.toLowerCase()
    );

    return {
      ok: false,
      issue: {
        name,
        reason: isReserved
          ? `'${name}' is auto-captured context and is not writable. 'source', 'url' and 'action' are accepted under 'meta' on create.`
          : `'${name}' is not an Embedded Data field on this survey.`,
        code: "unsupported_field",
      },
    };
  }

  if (group.length > 1) {
    return {
      ok: false,
      issue: {
        name,
        reason: `'${name}' matches more than one Embedded Data field on this survey, so it cannot say which one to write. Rename one of them.`,
        code: "duplicate_identifier",
      },
    };
  }

  return { ok: true, linked: group[0] };
};

/** What one payload entry does to storage, decided before anything is applied. */
type TEmbeddedWriteEffect =
  | { kind: "issue"; issue: InvalidParam }
  /** A locked field: the write is ignored rather than refused. */
  | { kind: "ignore" }
  | { kind: "clearData"; storageKey: string }
  | { kind: "clearVariable"; storageKey: string }
  | { kind: "writeVariable"; storageKey: string; value: TResponseDataValue }
  | { kind: "writeIngested"; storageKey: string; value: string | number | boolean };

/**
 * Decide what one `embeddedData` entry does, without doing it.
 *
 * Separating the decision from the application is what keeps the rules readable: every refusal, and
 * the reason for it, is reachable from this one function, while the caller below is a plain fold
 * over the effects.
 */
const planEmbeddedEntry = (
  byName: ReadonlyMap<string, TLinkedEmbeddedField[]>,
  elementIds: ReadonlySet<string>,
  name: string,
  value: string | number | boolean | null
): TEmbeddedWriteEffect => {
  const matched = matchDeclaredField(byName, name);
  if (!matched.ok) return { kind: "issue", issue: matched.issue };

  const { field, link } = matched.linked;

  // A locked field ignores the write rather than refusing it — the same verdict the ingest contract
  // reaches, and it covers the clear as well: `null` on a locked field is still a write.
  if (field.locked) return { kind: "ignore" };

  if (field.source === "computed") {
    if (value === null) return { kind: "clearVariable", storageKey: link.storageKey };

    // Stricter than the ingested path, deliberately. A variable feeds quota evaluation and recall,
    // so a value that cannot honestly represent its declared type would corrupt a downstream
    // calculation rather than just read back oddly — and unlike a hidden field arriving from a URL,
    // this one was typed by a caller who can be told.
    const normalized = normalizeIngestedValue(value, field.dataType);
    if (normalized === undefined || normalized.flag === "coercion_failed") {
      return {
        kind: "issue",
        issue: {
          name,
          reason: `'${name}' is a ${field.dataType} variable and cannot store this value.`,
          code: "unsupported_field",
          referenceType: "variable",
        },
      };
    }

    return { kind: "writeVariable", storageKey: link.storageKey, value: normalized.value };
  }

  // An answer owns this address and an answer is never rewritten, so the field can never hold a
  // value — which is why the read reports neither the field nor a place to put one. Refused here
  // rather than left to `applyIngestContract`: its answer pass-through would write the value as an
  // answer before its own collision check ever ran.
  if (elementIds.has(link.storageKey)) {
    return {
      kind: "issue",
      issue: {
        name,
        reason: `'${name}' is stored under an id a question already owns on this survey, so it holds the answer rather than a field value.`,
        code: "unsupported_field",
        referenceType: "hiddenField",
      },
    };
  }

  if (value === null) return { kind: "clearData", storageKey: link.storageKey };

  return { kind: "writeIngested", storageKey: link.storageKey, value };
};

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

  const byName = indexFieldsByName(embeddedFields);

  for (const [name, value] of Object.entries(incoming)) {
    const effect = planEmbeddedEntry(byName, elementIds, name, value);

    switch (effect.kind) {
      case "issue":
        issues.push(effect.issue);
        break;
      case "clearData":
        dataClears.push(effect.storageKey);
        break;
      case "clearVariable":
        variableClears.push(effect.storageKey);
        break;
      case "writeVariable":
        variableWrites[effect.storageKey] = effect.value;
        break;
      case "writeIngested":
        ingestedBag[effect.storageKey] = effect.value;
        break;
      default:
        break;
    }
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

  issues.push(...ingestDropIssues(ingested.dropped));

  return { dataWrites: ingested.data, dataClears, variableWrites, variableClears, issues };
};

/**
 * Both sides of a language comparison, reduced to one canonical form.
 *
 * Necessary because the two sides are canonicalized at different times by different code. A survey's
 * language rows go through `normalizeLanguageCode` when they are created (`lib/language/service.ts`),
 * so a real survey declares `de-DE`; a caller naturally sends `de`. Comparing the raw strings makes
 * those two disagree, and v1/v2 do not have that problem only because they canonicalize the caller's
 * value instead of matching it. Falls back to the raw value for a code that does not canonicalize, so
 * a private or legacy tag still matches itself.
 */
const canonicalLanguageKey = (code: string): string => (normalizeLanguageCode(code) ?? code).toLowerCase();

/**
 * Resolve the survey language a response will be stamped with, or say why it cannot be.
 *
 * **It returns the survey's own declared code rather than a canonicalized form of the caller's.**
 * That is the point of the function, and it is not cosmetic: `resolveV3LabelContext` matches a
 * response against the survey's language set by plain case-insensitive code equality, so a response
 * stored in any other spelling falls back to the survey default and every label on it comes back in
 * the wrong language. Validating against one value and storing another is what creates that gap, so
 * the value that matched is the value that gets stored.
 *
 * Matching is canonical, storing is verbatim — the two halves solve different problems. Matching
 * canonically is what lets a caller send `de` to a survey that declares `de-DE`, which v1 and v2 both
 * accept; comparing raw strings made v3 answer 422 where they answer 200, and that divergence was
 * only visible by driving all three APIs against the same survey.
 *
 * Stricter than the read's `resolveV3LabelContext` in one respect: that one falls back to the default
 * rather than failing, because a response collected before a language was removed still has to
 * serialize. A *write* has no such history to respect — a caller naming a language the survey does
 * not offer has made a mistake, and silently storing the default would attribute the response to the
 * wrong language forever.
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

  const wanted = canonicalLanguageKey(language);
  const matched = languages.find(
    (entry) => canonicalLanguageKey(entry.language.code) === wanted && (entry.enabled || entry.default)
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
