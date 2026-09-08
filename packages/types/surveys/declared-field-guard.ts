import type { z } from "zod";
import { RESERVED_FIELD_NAMES } from "../reserved-field-names";
import { type TSurveyHiddenFields, ZSurveyVariables } from "./types";
import {
  LINK_SURVEY_SYSTEM_PARAM_KEYS,
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
 * this write is *authoring*. Matching is case-insensitive in both directions, because a new `Lang`
 * would collide with the `?lang=` param the link survey reads for itself (only a grandfathered case
 * variant keeps being filled by its exact spelling, see `getHiddenFieldsFromSearchParams`), and
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
    // id lists are empty on purpose — passing the survey's names would report every grandfathered
    // name as a duplicate. A name shared across the two namespaces is a different check, with its
    // own grandfather rule: `validateNewDeclaredFieldClashes`.
    const error = validateId(name, [], [], [], [], { requireSafeIdentifier: true });
    if (error) errors.push(error);
  }

  return errors;
};

const isDeclared = <T>(carrier: T | null | undefined): carrier is T =>
  carrier !== undefined && carrier !== null;

/** Lower-cased name → the spelling the payload used, per namespace, for what a source declares. */
const namesByNamespace = (
  source: TDeclaredFieldSource
): { variables: Map<string, string>; hiddenFields: Map<string, string> } => ({
  variables: new Map(
    isDeclared(source.variables)
      ? source.variables.map((variable) => [variable.name.toLowerCase(), variable.name])
      : []
  ),
  hiddenFields: new Map(
    isDeclared(source.hiddenFields)
      ? (source.hiddenFields.fieldIds ?? []).map((id) => [id.toLowerCase(), id])
      : []
  ),
});

/**
 * Refuses a name that a variable and a hidden field would share after the write — unless the survey
 * already holds that exact clash.
 *
 * Recall and logic address variables and hidden fields *by name*, so two fields under one name are
 * ambiguous by construction. The editor refuses this in both directions and the v3 reference
 * validation refuses it as `duplicate_identifier`; the v1 management API had no check at all (ENG-2933).
 * Nothing further down catches it either: the reconcile's `assertNoDuplicateStorageKeys` compares
 * storage keys, and a variable is stored under its `id` while a hidden field is stored under its
 * name, so the two never collide there.
 *
 * Grandfathered like reserved names, and per-save for the same reasons ({@link validateNewDeclaredFieldNames}):
 * surveys in production already hold `first_name` as both, and their read-modify-write PUT must keep
 * working. A clash is refused only when the survey did not already hold it — so adding a variable
 * `plan` beside an existing hidden field `plan` is refused, resending an existing pair is not, and
 * dropping one side spends the reprieve. Case-insensitive, matching the editor and v3.
 *
 * A carrier the payload never mentions (`undefined`/`null`) is the survey's current one, exactly as
 * the reconcile carries those rows over — so a payload that sends only `variables` is still checked
 * against the hidden fields it leaves in place.
 *
 * The error names the side the write introduces (the hidden field, when the variable already
 * existed; the variable otherwise), with the code the editor's hidden-fields card reports for the
 * same clash.
 */
export const validateNewDeclaredFieldClashes = ({
  existing,
  incoming,
}: {
  existing: TDeclaredFieldSource;
  incoming: TDeclaredFieldSource;
}): TValidateIdError[] => {
  const current = namesByNamespace(existing);
  const next = namesByNamespace({
    variables: isDeclared(incoming.variables) ? incoming.variables : existing.variables,
    hiddenFields: isDeclared(incoming.hiddenFields) ? incoming.hiddenFields : existing.hiddenFields,
  });

  const errors: TValidateIdError[] = [];
  for (const [lowered, variableName] of next.variables) {
    const hiddenFieldId = next.hiddenFields.get(lowered);
    if (hiddenFieldId === undefined) continue;
    if (current.variables.has(lowered) && current.hiddenFields.has(lowered)) continue;

    errors.push({
      code: TValidateIdErrorCode.Duplicate,
      field: current.variables.has(lowered) ? hiddenFieldId : variableName,
    });
  }

  return errors;
};

/**
 * Everything a write's declared field names must satisfy, for the write seams that hold a whole
 * survey on both sides (`updateSurvey`, `createSurvey`): no new reserved name, and no new clash
 * between a variable and a hidden field. One error per bad name — a name refused as reserved is not
 * reported a second time as a clash.
 *
 * The v3 patch route calls {@link validateNewDeclaredFieldNames} on its own: its reference validation
 * already refuses the clash as `duplicate_identifier`, so running this there would report it twice.
 */
export const validateNewDeclaredFields = ({
  existing,
  incoming,
}: {
  existing: TDeclaredFieldSource;
  incoming: TDeclaredFieldSource;
}): TValidateIdError[] => {
  const reserved = validateNewDeclaredFieldNames({
    existing: collectDeclaredFieldNames(existing),
    incoming: collectDeclaredFieldNames(incoming),
  });
  const refused = new Set(reserved.map((error) => error.field.toLowerCase()));
  const clashes = validateNewDeclaredFieldClashes({ existing, incoming }).filter(
    (error) => !refused.has(error.field.toLowerCase())
  );

  return [...reserved, ...clashes];
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
  //
  // Named after the reserved spelling rather than the incoming name: a refused `userid` collides with
  // `userId`, and the true statement is about that name — a hidden field called `userId` is never
  // filled from the URL, whatever casing the param arrives in. (A grandfathered `UserId` IS filled by
  // `?UserId=`, so the same sentence about the incoming case variant would be false.) "URL contract"
  // rather than "URL parameter" because `FORBIDDEN_IDS` also holds internal ids such as `end` and
  // `welcomeCard`, which no URL carries.
  const systemParamKey = [...LINK_SURVEY_SYSTEM_PARAM_KEYS].find(
    (key) => key.toLowerCase() === field.toLowerCase()
  );
  if (systemParamKey !== undefined) {
    return `it collides with "${systemParamKey}", a name the link-survey URL contract reserves for itself, so a hidden field under that name is never filled from the URL`;
  }

  if (RESERVED_FIELD_NAMES.has(field.toLowerCase())) {
    return "it names an auto-captured system field that every survey can already read by name, so a second field under that name would be ambiguous in recall and logic";
  }

  // `validateId` classified this Reserved, so one of the two sets matched at the time. Reaching here
  // means the sets and this description have drifted; say something true rather than guess which.
  return "it is a reserved name";
};

/**
 * Why a name refused for a reason other than {@link TValidateIdErrorCode.Reserved} was refused, one
 * clause per code.
 *
 * Per code rather than one sentence for "not reserved": the old fallback returned the
 * `NotSafeIdentifier` sentence for every non-reserved code, so a caller sending `Team Size` was told
 * about lowercase letters when the space was the whole problem, and `""` produced the same sentence
 * as a charset violation. Each code now states the check that actually fired — so following the
 * message always moves the caller forward one check instead of around in a circle.
 */
const DECLARED_FIELD_NAME_REASONS: Record<Exclude<TValidateIdErrorCode, "reserved">, string> = {
  [TValidateIdErrorCode.Empty]: "it must not be empty",
  [TValidateIdErrorCode.HasSpaces]: "it must not contain spaces",
  [TValidateIdErrorCode.InvalidChars]: "it may contain only letters, numbers, underscores and hyphens",
  [TValidateIdErrorCode.NotSafeIdentifier]:
    "it must start with a lowercase letter and contain only lowercase letters, numbers and underscores",
  // Reached from `validateNewDeclaredFieldClashes` (a variable and a hidden field under one name),
  // never from `validateNewDeclaredFieldNames`, which passes empty id lists. Worded for that case
  // without assuming it — on a create both sides are new, so "already uses" would be false there.
  [TValidateIdErrorCode.Duplicate]:
    "a second field in this survey would carry that name, and recall and logic address fields by name",
};

/** The client-facing sentence for one refused name: `Field name "x" cannot be used: <reason>.` */
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
