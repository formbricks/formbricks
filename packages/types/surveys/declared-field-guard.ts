import type { z } from "zod";
import { RESERVED_FIELD_NAMES } from "../reserved-field-names";
import { type TSurveyHiddenFields, ZSurveyVariables } from "./types";
import {
  RESERVED_DECLARED_FIELD_NAMES,
  type TValidateIdError,
  TValidateIdErrorCode,
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
 * whatever is already stored. `validateId`'s strict mode is the same rule, but until now it was
 * passed from exactly one place (the hidden-fields editor card) — so
 * `PUT /api/v1/management/surveys/<id>` could still create a hidden field named `lang` or `country`
 * that `getHiddenFieldsFromSearchParams` then refuses to fill, leaving it silently empty forever.
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
}: {
  existing: string[];
  incoming: string[];
}): TValidateIdError[] => {
  const grandfathered = new Set(existing.map((name) => name.toLowerCase()));
  const seen = new Set<string>();
  const errors: TValidateIdError[] = [];

  for (const name of incoming) {
    const lowered = name.toLowerCase();
    if (grandfathered.has(lowered) || seen.has(lowered)) continue;
    seen.add(lowered);

    // Delegated rather than reimplemented so this guard and the editor card can never drift apart:
    // `validateId`'s strict branch is the single definition of what a new declared name may be. The
    // id lists are empty on purpose — a collision with an existing name is a *duplicate*, which the
    // reconcile's `assertNoDuplicateStorageKeys` and the v3 reference validation already own, and
    // reporting it here would turn a grandfathered name into an error.
    const error = validateId(name, [], [], [], [], { requireSafeIdentifier: true });
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

export const describeDeclaredFieldNameError = (error: TValidateIdError): string => {
  const reason =
    error.code === TValidateIdErrorCode.Reserved
      ? describeReservedReason(error.field)
      : "it must start with a lowercase letter and contain only lowercase letters, numbers and underscores";

  return `Field name "${error.field}" cannot be used: ${reason}.`;
};

/**
 * The full client-facing message for a set of refusals. Names a survey already declares are never in
 * here — they are grandfathered — so the trailing sentence is what tells an integrator why their
 * *other* survey with the same field name keeps working.
 */
export const describeDeclaredFieldNameErrors = (errors: TValidateIdError[]): string =>
  `${errors.map(describeDeclaredFieldNameError).join(" ")} Fields a survey already has keep working; this applies to newly added names only.`;
