import type { z } from "zod";
import { RESERVED_FIELD_NAMES } from "../reserved-field-names";
import { type TSurveyHiddenFields, ZSurveyVariables } from "./types";
import {
  RESERVED_DECLARED_FIELD_NAMES,
  type TValidateIdError,
  TValidateIdErrorCode,
  type TValidateIdRule,
  validateId,
} from "./validation";

/**
 * The legacy declared-field carriers of a survey write payload, as every write seam spells them:
 * one object literal with both keys present, each either populated or `undefined`.
 */
export interface TDeclaredFieldSource {
  hiddenFields?: Pick<TSurveyHiddenFields, "fieldIds"> | null;
  /**
   * Only `name` is required, deliberately: this reads nothing else, and the write seams hand it both
   * sides of the survey schema. `ZSurveyVariable` gives `value` a `prefault`, so a *create* payload
   * (`ZSurveyCreateInput`) types `value` as optional while a parsed survey types it as required -
   * demanding the *parsed* `TSurveyVariables` here made `createSurvey` fail to type check against
   * its own input, so this is the schema's input side: `value` optional, which a parsed survey
   * (value required) also satisfies.
   */
  variables?: z.input<typeof ZSurveyVariables> | null;
}

/**
 * The declared field names a payload actually *declares*.
 *
 * Presence is `!== undefined`, deliberately **not** the `in` operator — the same test
 * `resolveDesiredEmbeddedFields` (apps/web/lib/embedded-data/reconcile.ts) uses, and for the same
 * reason: every write seam builds one object literal with both keys spelled out and lets Prisma (or
 * the reconcile) ignore the undefined ones. Under `in`, a patch that never mentioned `hiddenFields`
 * would read as declaring the empty set, and the two modules would disagree about what a payload
 * said — the reconcile carrying the current rows over while the guard treated them as absent.
 *
 * A `null` carrier is treated as absent for the same reason: it declares nothing to validate.
 */
export const collectDeclaredFieldNames = (source: TDeclaredFieldSource): string[] => [
  ...(source.variables !== undefined && source.variables !== null
    ? source.variables.map((variable) => variable.name)
    : []),
  ...(source.hiddenFields !== undefined && source.hiddenFields !== null
    ? (source.hiddenFields.fieldIds ?? [])
    : []),
];

/**
 * Refuses reserved names for **newly declared** field names, and only for those.
 *
 * This is the create-time layer the lenient load-time schemas cannot be: `ZSurveyHiddenFields` and
 * `ZSurveyVariables` also parse surveys read back out of the database, so they must keep accepting
 * whatever is already stored. Before this guard existed, `validateId`'s declared-field rule was
 * passed from exactly one place (the editor cards) — so `PUT /api/v1/management/surveys/<id>` could
 * still create a hidden field named `lang` that `getHiddenFieldsFromSearchParams` then refuses to
 * fill, leaving it silently empty forever.
 *
 * ## The rule is the caller's, and the two callers disagree on purpose
 *
 * Every server write path passes `declaredFieldPortable`, which refuses only names that can never
 * receive a value. It does **not** refuse Tier-1 catalog names and does **not** apply
 * `isSafeIdentifier`: ENG-2539 decided those two belong to the editor, where a human sees the error
 * inline, and applying them at a documented API boundary inside the ENG-1838 back-compat milestone
 * broke automation that re-creates surveys from a stored JSON export. The full reasoning, rule by
 * rule, is on {@link validateId}.
 *
 * The editor does not reach this function at all — `hidden-fields-card.tsx` and
 * `survey-variables-card-item.tsx` call `validateId` directly with `declaredFieldStrict`, which is
 * why relaxing the server side leaves every editor message and Playwright toast untouched.
 *
 * ## Grandfathering is the whole point
 *
 * Surveys in production already declare `country`, `url`, `source`, `browser`. Their values live at
 * `response.data["country"]`, `#recall:country#` resolves from there, and nothing may be renamed. So
 * a name already in `existing` returns **no error**, whatever it is — the blocklist applies to names
 * this write is *authoring*. Matching is case-insensitive in both directions, because
 * `getHiddenFieldsFromSearchParams` refuses to capture a reserved param under any casing, and
 * because `Country` and `country` would collide in the recall namespace all the same.
 *
 * Duplicate incoming names yield one error each at most — the caller sees one error per bad name.
 *
 * ## Grandfathering is per-save, not permanent — and that is deliberate
 *
 * `existing` is the survey's *current* names, so the reprieve lasts exactly as long as the field does.
 * Delete a grandfathered `country` field, save, and it can no longer be added back: the next write
 * sees an `existing` set without it and refuses the name like any other new declaration. Editing the
 * field, renaming other fields around it, or saving the survey untouched all keep it — only removing
 * it spends the reprieve.
 *
 * That is the intended reading of "already declared". The alternative — remembering every name a
 * survey ever had — would need storage this layer does not have, and would keep a name reserved for a
 * survey that no longer uses it. A survey that gives up its declared `country` gains the auto-captured
 * one in exchange, which is the field the name is supposed to mean from here on.
 *
 * The client-facing message says "fields a survey already has keep working", which is true of the
 * survey as it stands and is what an integrator hitting this on a *different* survey needs to hear.
 * Someone who deleted the field yesterday and is re-adding it today is the one case where that
 * sentence reads as contradicting them; pinned by a test so the behaviour is a decision rather than an
 * accident.
 *
 * @param existing - Every declared field name the survey already has (variables + hidden fields).
 *   Pass `[]` on a create, which authors every name fresh.
 * @param incoming - The declared field names the payload carries, from
 *   {@link collectDeclaredFieldNames}.
 * @returns One error per refused new name, or `[]` when everything is allowed.
 */
export const validateNewDeclaredFieldNames = ({
  existing,
  incoming,
  rule,
}: {
  existing: string[];
  incoming: string[];
  rule: Extract<TValidateIdRule, "declaredFieldStrict" | "declaredFieldPortable">;
}): TValidateIdError[] => {
  const grandfathered = new Set(existing.map((name) => name.toLowerCase()));
  const seen = new Set<string>();
  const errors: TValidateIdError[] = [];

  for (const name of incoming) {
    const lowered = name.toLowerCase();
    if (grandfathered.has(lowered) || seen.has(lowered)) continue;
    seen.add(lowered);

    // Delegated rather than reimplemented so this guard and the editor card can never drift apart:
    // `validateId` is the single definition of what a new declared name may be under each rule, and
    // ENG-2539's decision that the API and the editor disagree lives there rather than being
    // open-coded here. The id lists are empty on purpose — a collision with an existing name is a
    // *duplicate*, which the reconcile's `assertNoDuplicateStorageKeys` and the v3 reference
    // validation already own, and reporting it here would turn a grandfathered name into an error.
    const error = validateId(name, [], [], [], [], { rule });
    if (error) errors.push(error);
  }

  return errors;
};

/**
 * One human-readable sentence for a set of refusals, for the error a write path returns to its
 * client. Server-side and non-localized, matching `APP_SURVEY_TRIGGER_REQUIRED_MESSAGE` and the rest
 * of this layer; the editor refuses these names client-side with a translated toast long before a
 * request is made.
 */
const describeReservedReason = (field: string): string => {
  // Order matters: a name in BOTH lists (`source` is the one Tier-1 field that is also a link-survey
  // system param) gets the capture-refusal reason, which is the stronger and still-true statement.
  //
  // The catalog branch below is unreachable from today's write paths, which all pass
  // `declaredFieldPortable` (ENG-2539). It is kept because the rule is this function's parameter, not
  // its constant: a caller passing `declaredFieldStrict` — the editor rule — still needs a sentence
  // to show, and deleting it would mean re-deriving one the next time the boundary moves.
  //
  // The two halves fail for genuinely different reasons, and saying "could never receive a value" for
  // the catalog half would be actively misleading: `RESERVED_FIELD_NAMES` is deliberately kept OUT of
  // the capture-refusal list read by `getHiddenFieldsFromSearchParams`, precisely so `?country=DE`
  // keeps filling the field of a survey that already declares `country`. An integrator told the wrong
  // reason here could go and remove URL params that work.
  if (RESERVED_DECLARED_FIELD_NAMES.has(field.toLowerCase())) {
    return "it is reserved by the link-survey URL contract, so a field declared under it is never filled from the URL and would stay empty";
  }

  if (RESERVED_FIELD_NAMES.has(field.toLowerCase())) {
    return "it names an auto-captured system field that every survey can already read by name, so a second field under that name would be ambiguous in recall and logic";
  }

  // `validateId` classified this Reserved, so one of the two sets matched at the time. Reaching here
  // means the sets and this description have drifted; say something true rather than guess which.
  return "it is a reserved name";
};

/**
 * Why a name that is refused for a reason other than {@link TValidateIdErrorCode.Reserved} was
 * refused, one clause per code.
 *
 * Per code rather than one sentence for "not reserved", because the two rules no longer agree on
 * what a name may look like (ENG-2539) and only the code says which check actually fired. Every
 * write path passes `declaredFieldPortable`, so the sentence this used to return for *anything*
 * non-reserved — the `NotSafeIdentifier` one below — described a rule the API deliberately does not
 * apply: it told a caller sending `Team Size` to use only lowercase letters, numbers and
 * underscores, when `Team-Size` is accepted and the space is the whole problem. Following the
 * caller's advice there still yields a 400, and both docs surfaces promise the looser charset.
 *
 * `NotSafeIdentifier` keeps that wording because it is the one code that really does mean it, and
 * `declaredFieldStrict` is the only rule that can produce it.
 */
const DECLARED_FIELD_NAME_REASONS: Record<Exclude<TValidateIdErrorCode, "reserved">, string> = {
  [TValidateIdErrorCode.Empty]: "it must not be empty",
  [TValidateIdErrorCode.HasSpaces]: "it must not contain spaces",
  [TValidateIdErrorCode.InvalidChars]: "it may contain only letters, numbers, underscores and hyphens",
  [TValidateIdErrorCode.NotSafeIdentifier]:
    "it must start with a lowercase letter and contain only lowercase letters, numbers and underscores",
  // Unreachable from `validateNewDeclaredFieldNames`, which passes empty id lists so a collision is
  // never reported here. Spelled out anyway: the map is exhaustive over the enum, so a caller that
  // does pass id lists gets a true sentence instead of falling through to a wrong one.
  [TValidateIdErrorCode.Duplicate]: "another field in this survey already uses that name",
};

/**
 * The client-facing sentence for one refused name — `Field name "x" cannot be used: <reason>.`
 *
 * Server-side and non-localized, like the rest of this layer. The editor never reaches it: its two
 * cards call `validateId` directly and render a translated message, which is why the reasons here
 * can describe the API's rule without touching an author-facing string.
 */
export const describeDeclaredFieldNameError = (error: TValidateIdError): string => {
  const reason =
    error.code === TValidateIdErrorCode.Reserved
      ? describeReservedReason(error.field)
      : DECLARED_FIELD_NAME_REASONS[error.code];

  return `Field name "${error.field}" cannot be used: ${reason}.`;
};

/**
 * The full client-facing message for a set of refusals. Names a survey already declares are never in
 * here — they are grandfathered — so the trailing sentence is what tells an integrator why their
 * *other* survey with the same field name keeps working.
 */
export const describeDeclaredFieldNameErrors = (errors: TValidateIdError[]): string =>
  `${errors.map(describeDeclaredFieldNameError).join(" ")} Fields a survey already has keep working; this applies to newly added names only.`;
