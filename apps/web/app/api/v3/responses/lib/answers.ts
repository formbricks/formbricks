import { listReadableFields } from "@formbricks/types/embedded-data-resolver";
import type { TResponseData, TResponseTtc } from "@formbricks/types/responses";
import { MAX_RESPONSE_TTC } from "@formbricks/types/responses";
import type { TSurveyBlock } from "@formbricks/types/surveys/blocks";
import type { TSurveyElement } from "@formbricks/types/surveys/elements";
import { LINK_SURVEY_SYSTEM_PARAM_KEYS } from "@formbricks/types/surveys/validation";
import { localizeSurveyString } from "./label-resolution";
import {
  type TV3ResponseAnswer,
  type TV3ResponseSelection,
  type TV3ResponseUnresolvedEntry,
  V3_ADDRESS_FIELD_IDS,
  V3_CONTACT_INFO_FIELD_IDS,
} from "./resources";

/**
 * Turning `Response.data` into the contract's typed `answers[]`.
 *
 * The stored map is flat, untyped and shared with hidden-field values, so every branch here is a
 * narrowing of `unknown`. Nothing throws: a value whose shape does not fit its element becomes an
 * `unresolved[]` entry with the raw value intact and the walk continues. A serializer that throws on
 * one odd row makes the whole page 500, and these rows are years old and were written by several
 * client versions.
 */

/** Everything about a survey that answer serialization needs, computed once per survey per language. */
export interface TV3AnswerPlan {
  /** 1-based position in the flattened block order, which is the order a respondent saw. */
  positionById: Map<string, number>;
  elementById: Map<string, TSurveyElement>;
  /** Headlines, already localized, HTML-stripped and recall-flattened. */
  labelById: Map<string, string>;
  /**
   * Storage keys of the survey's declared ingested fields — hidden fields, which are stored under
   * their name in the same map as answers. `answers[]` must skip them: they are not answers, and
   * `embeddedData[]` already reports them.
   *
   * A key that is also an element id is **not** in this set, however it was declared. The ingest
   * contract drops such a field (`element_id_collision`) because a question answer owns that
   * address, so the value stored there is an answer and belongs in `answers[]`. Skipping it would
   * relabel a respondent's answer as caller-supplied context.
   */
  ingestedStorageKeys: ReadonlySet<string>;
  lookupKey: string;
}

export const buildAnswerPlan = (
  blocks: TSurveyBlock[],
  lookupKey: string,
  ingestedStorageKeys: Iterable<string> = []
): TV3AnswerPlan => {
  const elements = blocks.flatMap((block) => block.elements);

  // Reused rather than reimplemented: `toElementLabel` localizes with the `default` fallback, strips
  // rich text and flattens recall tokens, and `labelOrKey` falls back to the element id when the
  // result is blank. Both are module-private, and this is the exported way to reach them. Emitting a
  // raw `#recall:…#` token or a `<p>` into an API payload is the failure this avoids.
  const readable = listReadableFields({
    blocks,
    embeddedData: [],
    reservedEntries: [],
    contactAttributeKeys: [],
    languageCode: lookupKey,
  });

  // Exact, case-sensitive, matching `embedded-data-ingest.ts` — it is the same string that keys
  // `response.data`, and a field differing only by case addresses a different slot entirely.
  const elementIds = new Set(elements.map((element) => element.id));

  return {
    positionById: new Map(elements.map((element, index) => [element.id, index + 1])),
    elementById: new Map(elements.map((element) => [element.id, element])),
    labelById: new Map(readable.question.map(({ key, label }) => [key, label])),
    ingestedStorageKeys: new Set([...ingestedStorageKeys].filter((key) => !elementIds.has(key))),
    lookupKey,
  };
};

const MAX_DURATION_SECONDS = MAX_RESPONSE_TTC / 1000;

/** The whole-response bucket the server keeps in `ttc` alongside real element ids. */
const TTC_TOTAL_BUCKET = "_total";

/**
 * Milliseconds to seconds, clamped into the range the contract publishes.
 *
 * The stored `ZResponseTtc` is deliberately unbounded so rows written before the ENG-1083 write-side
 * clamp still parse, which means a real row can hold a negative value or a tab left open for days.
 * Clamping on read keeps the published `minimum`/`maximum` true of every row; returning the raw value
 * would make the API violate its own schema on legitimate historical data.
 *
 * Rounded to milliseconds' worth of precision so `performance.now()` float noise does not surface as
 * `4.3216000000000005`.
 */
const toDurationSeconds = (milliseconds: unknown): number | undefined => {
  if (typeof milliseconds !== "number" || !Number.isFinite(milliseconds)) {
    return undefined;
  }

  return Math.round(Math.min(Math.max(milliseconds, 0), MAX_RESPONSE_TTC)) / 1000;
};

/**
 * The response's total duration: every per-element measurement, summed.
 *
 * `_total` is excluded because it is a bucket the server maintains alongside real element ids, so
 * including it would double-count the whole response. Summing rather than reading it is deliberate
 * — the bucket is only written when a response finishes, so reading it would leave every partial
 * response without a duration even when it carries per-element timing.
 *
 * Each term goes through the same clamp the per-answer value does, so the total is the sum of the
 * durations actually published and a single negative legacy entry cannot pull it below its parts.
 * The total itself is not capped: `MAX_RESPONSE_TTC` is a per-element bound, and the contract
 * publishes a minimum of 0 with no maximum here.
 *
 * `undefined` when nothing usable was recorded, which the contract spells as the field being absent.
 */
export const sumV3DurationSeconds = (ttc: TResponseTtc | undefined): number | undefined => {
  if (!ttc) return undefined;

  let total = 0;
  let counted = false;

  for (const [key, milliseconds] of Object.entries(ttc)) {
    if (key === TTC_TOTAL_BUCKET) continue;

    const seconds = toDurationSeconds(milliseconds);
    if (seconds === undefined) continue;

    total += seconds;
    counted = true;
  }

  // Re-rounded: summing values already divided by 1000 reintroduces binary-fraction drift, so a
  // page of ordinary responses would otherwise carry totals like `12.600000000000001`.
  return counted ? Math.round(total * 1000) / 1000 : undefined;
};

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === "string");

const isStringRecord = (value: unknown): value is Record<string, string> =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  Object.values(value).every((entry) => typeof entry === "string");

/**
 * The one id that names a behaviour rather than an option, and so is never matched as a value.
 *
 * The renderer stores `""` — not `"other"` — for an Other selection left blank, so a literal
 * `"other"` arriving as a value is a label that happens to read "other", not a selection of the
 * Other option; matching it by id would name the wrong choice. The fall-through below handles a
 * real write-in.
 *
 * `none` is deliberately NOT here. A "None of the above" choice is author-written and translatable,
 * and the renderer stores its **label** like any other option: `multiple-choice-single-element.tsx`
 * re-adds it to `allOptions` after filtering it out of `options`, and its own Other test excludes
 * only `other`, so a stored none label matches a real choice there. The summary counts it as its
 * own option too. Reserving it made a respondent who picked it come back as an Other write-in — or
 * as `unmatched` on an element offering no Other — which no other surface agrees with.
 */
const RESERVED_CHOICE_IDS = new Set(["other"]);

/**
 * The element's Other choice, if it offers one.
 *
 * The renderer's own test (`multiple-choice-single-element.tsx:63-64`). Deliberately **not**
 * `otherOptionPlaceholder !== undefined`: deleting the Other choice in the editor removes the choice
 * without clearing the placeholder, so that predicate stays true forever once set.
 */
const findOtherChoice = (element: TSurveyElement): { id: string; label?: unknown } | undefined =>
  "choices" in element && Array.isArray(element.choices)
    ? (element.choices as { id: string; label?: unknown }[]).find((choice) => choice.id === "other")
    : undefined;

/**
 * Resolve one stored choice value against the current definition.
 *
 * Precedence is the contract's and is fixed: option **id**, then option **label**, then `other`,
 * then `unmatched`.
 *
 * **On `other`, and why it is a judgement rather than a fact.** Nothing in storage marks a write-in.
 * The renderer decides "this was Other" by the same elimination this does — see
 * `multiple-choice-single-element.tsx:87-89`, "Otherwise, it's a custom value => other" — and then
 * stores the bare string the respondent typed. So a write-in and an option renamed since collection
 * are byte-identical, and no reader can separate them.
 *
 * Given that, `other` is reported when nothing resolves **and** the element offers an Other input.
 * That is what the renderer, the summary and the Hub transform all already conclude from the same
 * bytes, so a different answer here would make v3 the one surface that disagrees. `unmatched` is
 * then the honest answer for an element with no Other input, where a write-in is impossible and an
 * unresolvable value can only be a renamed or deleted option.
 */
const resolveSelection = (
  raw: string,
  element: TSurveyElement,
  lookupKey: string,
  rank?: number
): TV3ResponseSelection => {
  const choices =
    "choices" in element && Array.isArray(element.choices)
      ? (element.choices as { id: string; label?: unknown }[])
      : [];

  for (const choice of choices) {
    if (RESERVED_CHOICE_IDS.has(choice.id)) continue;
    if (choice.id === raw) {
      const label = localizeSurveyString(choice.label as never, lookupKey);
      // `pictureSelection` choices carry no label at all, so `null` is the only honest answer there.
      return {
        optionId: choice.id,
        optionLabel: label || null,
        rawValue: raw,
        match: "exact",
        ...rankOf(rank),
      };
    }
  }

  for (const choice of choices) {
    if (RESERVED_CHOICE_IDS.has(choice.id)) continue;
    if (choice.label === undefined) continue;
    if (localizeSurveyString(choice.label as never, lookupKey) === raw) {
      return { optionId: choice.id, optionLabel: raw, rawValue: raw, match: "label", ...rankOf(rank) };
    }
  }

  const other = findOtherChoice(element);
  if (other) {
    // The Other option is a real option with a real id, so a write-in names it. Returning nulls here
    // would emit the exact payload the contract reserves for "nothing resolved" while claiming the
    // opposite in `match`.
    return {
      optionId: other.id,
      optionLabel: localizeSurveyString(other.label as never, lookupKey) || null,
      rawValue: raw,
      match: "other",
      ...rankOf(rank),
    };
  }

  return { optionId: null, optionLabel: null, rawValue: raw, match: "unmatched", ...rankOf(rank) };
};

const rankOf = (rank?: number): { rank?: number } => (rank === undefined ? {} : { rank });

/** The sub-field ids and their placeholder configs, in the fixed storage order for each type. */
const compositeFields = (element: TSurveyElement): readonly string[] =>
  element.type === "address" ? V3_ADDRESS_FIELD_IDS : V3_CONTACT_INFO_FIELD_IDS;

type Serialized = { answer: TV3ResponseAnswer } | { reason: TV3ResponseUnresolvedEntry["reason"] };

/**
 * One stored value to one answer, or a reason it could not be read.
 *
 * Every branch narrows before it reads. `valueShapeMismatch` is returned rather than thrown, and
 * rather than coerced — a `matrix` element holding a string is a real row somewhere, and guessing
 * what it meant invents data.
 */
const serializeOne = (
  element: TSurveyElement,
  raw: unknown,
  base: { position: number; elementId: string; elementLabel: string; durationSeconds?: number },
  lookupKey: string
): Serialized => {
  const mismatch = { reason: "valueShapeMismatch" as const };

  switch (element.type) {
    case "openText": {
      // Always a string, `inputType: number` included — the contract says so and the renderer agrees.
      if (typeof raw !== "string") return mismatch;
      return {
        answer: {
          ...base,
          elementType: "openText",
          valueText: raw,
          ...(element.inputType ? { inputType: element.inputType } : {}),
        },
      };
    }

    case "nps": {
      if (typeof raw !== "number") return mismatch;
      // Hardcoded because `ZSurveyNPSElement` declares neither `range` nor `scale`: NPS is 0-10 by
      // definition. Falling back to the base element's `range` would be wrong — its union omits 0.
      return { answer: { ...base, elementType: "nps", valueNumber: raw, range: { min: 0, max: 10 } } };
    }

    case "rating":
    case "csat":
    case "ces": {
      if (typeof raw !== "number") return mismatch;
      return {
        answer: {
          ...base,
          elementType: element.type,
          valueNumber: raw,
          range: { min: 1, max: element.range },
          scale: element.scale,
        },
      };
    }

    case "consent": {
      if (typeof raw !== "string") return mismatch;
      return { answer: { ...base, elementType: "consent", valueBoolean: raw === "accepted", rawValue: raw } };
    }

    case "cta": {
      // Legacy rows also hold `"dismissed"`, which is a real skip and reads as `false`.
      if (typeof raw !== "string") return mismatch;
      return { answer: { ...base, elementType: "cta", valueBoolean: raw === "clicked", rawValue: raw } };
    }

    case "cal": {
      if (typeof raw !== "string") return mismatch;
      return { answer: { ...base, elementType: "cal", booked: raw === "booked", rawValue: raw } };
    }

    case "date": {
      // Verbatim. Rows written by older clients carry the element's display format rather than an
      // ISO day, and reformatting one without knowing which it is would move the date.
      if (typeof raw !== "string") return mismatch;
      return { answer: { ...base, elementType: "date", valueDate: raw } };
    }

    case "fileUpload": {
      if (!isStringArray(raw)) return mismatch;
      return { answer: { ...base, elementType: "fileUpload", fileUrls: raw, fileCount: raw.length } };
    }

    case "address":
    case "contactInfo": {
      // A fixed-length positional array, blanks included. Every slot is emitted, because dropping an
      // empty one shifts every later value onto the wrong field and makes the stored array
      // unreconstructable. Slots the author has switched off are stored as `""` too.
      if (!isStringArray(raw)) return mismatch;
      const ids = compositeFields(element);
      // A longer array than the type has slots cannot be represented as `fields` without losing the
      // overflow, and silently dropping part of a stored value is the one thing this module does not
      // do. Reported as a shape mismatch instead, which carries the whole array through untouched.
      if (raw.length > ids.length) return mismatch;
      return {
        answer: {
          ...base,
          elementType: element.type,
          fields: ids.map((fieldId, slot) => ({
            slot,
            fieldId: fieldId as
              | (typeof V3_ADDRESS_FIELD_IDS)[number]
              | (typeof V3_CONTACT_INFO_FIELD_IDS)[number],
            fieldLabel: localizeSurveyString(
              (
                element as unknown as Record<
                  string,
                  { placeholder?: Parameters<typeof localizeSurveyString>[0] }
                >
              )[fieldId]?.placeholder,
              lookupKey
            ),
            valueText: raw[slot] ?? "",
          })),
        },
      };
    }

    case "matrix": {
      // Keyed by the **localized row label** in the respondent's language, valued by the localized
      // column label — never ids. So `rawKey` is what rebuilds the stored object, and `rowLabel` is
      // that row resolved in the *current* language, which can differ.
      if (!isStringRecord(raw)) return mismatch;
      return {
        answer: {
          ...base,
          elementType: "matrix",
          // A blank value is a row the respondent left alone. The contract says so directly —
          // "One entry per row the respondent answered. Rows left blank are omitted rather than
          // returned" — and both display readers already skip them, so publishing them as
          // `unmatched` invented rows that were never answered and mislabelled the reason.
          rows: Object.entries(raw)
            .filter(([, rawValue]) => rawValue !== "")
            .map(([rawKey, rawValue]) => {
              const row = element.rows.find(
                (entry) => localizeSurveyString(entry.label, lookupKey) === rawKey
              );
              const column = element.columns.find(
                (entry) => localizeSurveyString(entry.label, lookupKey) === rawValue
              );
              return {
                rawKey,
                rowId: row?.id ?? null,
                rowLabel: row ? localizeSurveyString(row.label, lookupKey) : rawKey,
                columnId: column?.id ?? null,
                columnLabel: column ? localizeSurveyString(column.label, lookupKey) : null,
                rawValue,
                match: column ? ("label" as const) : ("unmatched" as const),
              };
            }),
        },
      };
    }

    case "multipleChoiceSingle": {
      if (typeof raw !== "string") return mismatch;
      return {
        answer: {
          ...base,
          elementType: "multipleChoiceSingle",
          selections: [resolveSelection(raw, element, lookupKey)],
        },
      };
    }

    case "multipleChoiceMulti":
    case "pictureSelection": {
      // `pictureSelection` stores choice **ids**, so it resolves `exact` and carries no label —
      // `ZSurveyPictureChoice` has none. `multipleChoiceMulti` stores localized labels.
      if (!isStringArray(raw)) return mismatch;
      return {
        answer: {
          ...base,
          elementType: element.type,
          selections: raw.map((entry) => resolveSelection(entry, element, lookupKey)),
        },
      };
    }

    case "ranking": {
      // Stored in drag order, so the array index is the rank.
      if (!isStringArray(raw)) return mismatch;
      return {
        answer: {
          ...base,
          elementType: "ranking",
          selections: raw.map((entry, index) => resolveSelection(entry, element, lookupKey, index + 1)),
        },
      };
    }

    default:
      return mismatch;
  }
};

/**
 * Split `Response.data` into resolved answers and everything that could not be read as one.
 *
 * Answers come back in survey order rather than storage order, because the stored map's key order is
 * whatever the client happened to send. Keys with no element in the current definition are the
 * caller's to interpret, so they land in `unresolved[]` rather than being dropped — that collection
 * is the whole reason a renamed or deleted element does not silently lose data.
 */
/**
 * Whether a stored `data` key may appear in the detail view's `data` map.
 *
 * The map is what `PATCH` accepts, and the contract narrows that to element answers: a declared
 * hidden field's name is refused there with a 422, and a runtime-stamped system key was never a
 * caller's to send. Echoing either would publish a value the write side rejects, so a read-edit-write
 * round trip would fail on bytes this endpoint had just handed out.
 *
 * Unknown keys are kept: a renamed or deleted element's value is still the caller's data, and
 * `unresolved[]` reports it alongside.
 */
export const isPublishableDataKey = (plan: TV3AnswerPlan, key: string): boolean => {
  if (plan.ingestedStorageKeys.has(key)) return false;
  if (plan.elementById.has(key)) return true;

  return !LINK_SURVEY_SYSTEM_PARAM_KEYS.has(key);
};

export const serializeAnswers = (
  plan: TV3AnswerPlan,
  data: TResponseData,
  ttc: TResponseTtc | undefined
): { answers: TV3ResponseAnswer[]; unresolved: TV3ResponseUnresolvedEntry[] } => {
  const answers: TV3ResponseAnswer[] = [];
  const unresolved: TV3ResponseUnresolvedEntry[] = [];

  for (const [key, raw] of Object.entries(data)) {
    // A hidden field's value lives in this same map, under the field's name. It is not an answer
    // and it is not a deleted element — `embeddedData[]` reports it — so skipping it here is what
    // keeps it from being published twice, the second time as a deletion that never happened.
    // `buildAnswerPlan` has already removed any key an element claims, so a collision falls
    // through to the answer path below rather than being skipped.
    if (plan.ingestedStorageKeys.has(key)) continue;

    // A JSON null is not a value the contract can carry: `rawValue` is a four-shape union with no
    // null member, so reporting one would emit a payload the published schema rejects. It is also
    // nothing a caller can act on — there are no bytes to recover.
    if (raw === null) continue;

    const element = plan.elementById.get(key);
    if (!element) {
      // Keys the runtime stamps into the answer map itself, checked only AFTER the element lookup:
      // `verifiedEmail` is the respondent's verified address, written by the email gate, and
      // `unresolved[]` publishes `rawValue` verbatim — so reporting it here would put a real email
      // in both views of every gated response. The element lookup comes first deliberately: these
      // are names a survey may not newly declare, but a legacy survey can hold an element called
      // `start` or `source`, and suppressing a real answer would be the same loss in a new place.
      if (LINK_SURVEY_SYSTEM_PARAM_KEYS.has(key)) continue;

      unresolved.push({
        key,
        rawValue: raw as TV3ResponseUnresolvedEntry["rawValue"],
        reason: "elementNotInSurvey",
      });
      continue;
    }

    const result = serializeOne(
      element,
      raw,
      {
        position: plan.positionById.get(key) ?? 1,
        elementId: key,
        elementLabel: plan.labelById.get(key) ?? key,
        ...withDuration(ttc?.[key]),
      },
      plan.lookupKey
    );

    if ("reason" in result) {
      unresolved.push({
        key,
        rawValue: raw as TV3ResponseUnresolvedEntry["rawValue"],
        reason: result.reason,
      });
      continue;
    }

    answers.push(result.answer);
  }

  answers.sort((a, b) => a.position - b.position);

  return { answers, unresolved };
};

const withDuration = (milliseconds: unknown): { durationSeconds?: number } => {
  const seconds = toDurationSeconds(milliseconds);
  return seconds === undefined ? {} : { durationSeconds: seconds };
};

export const V3_MAX_DURATION_SECONDS = MAX_DURATION_SECONDS;
