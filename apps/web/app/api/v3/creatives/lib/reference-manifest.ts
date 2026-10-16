/**
 * What a creative write body says about things that are not its own (the ENG-2861 roster, as the
 * Responses resource keeps it). Every field of `POST /api/v3/creatives` and `PATCH
 * /api/v3/creatives/{creativeId}` is classified here, and `reference-manifest.test.ts` holds the roster to
 * the generated schemas by set equality: a field the contract grows fails until someone says whether it
 * names something that must belong to the caller, and where that is checked.
 *
 * Paths: `.` for a property, `[]` for an array item, `{}` for a map value. A `subtree` entry covers every
 * field under it, for groups that are presentation only; an id-shaped field inside one still needs its
 * own entry, so a reference can't hide in a subtree.
 */

export type TV3CreativeReferenceKind =
  /** A foreign key resolved against its own table, filtered by the creative's workspace. */
  | "fk"
  /** Resolved by attribute rather than by key: a workspace `Language` found by code. */
  | "resolver"
  /** Set-membership against the request itself: a text map's locale keys against its languages. */
  | "document-local"
  /** Not a reference. Recorded rather than omitted, so the roster can be checked for completeness. */
  | "none";

export type TV3CreativeReference = {
  kind: TV3CreativeReferenceKind;
  /** Where the value is resolved, in terms a reviewer can check against the code. */
  resolvedAgainst: string;
  /** Covers every field under this path. */
  subtree?: true;
};

const none = (resolvedAgainst = "not a reference"): TV3CreativeReference => ({
  kind: "none",
  resolvedAgainst,
});
const presentation: TV3CreativeReference = {
  kind: "none",
  resolvedAgainst: "presentation only",
  subtree: true,
};
const localeKeys: TV3CreativeReference = {
  kind: "document-local",
  resolvedAgainst: "write-rules.ts getLanguageProblems: defaultLanguage and languages[].code",
};

export const V3_CREATIVE_BODY_FIELDS: Readonly<Record<string, TV3CreativeReference>> = {
  workspaceId: {
    kind: "fk",
    resolvedAgainst: "authorizeCreativeWorkspace (requireV3WorkspaceAccess, readWrite) before any write",
  },
  name: none(),
  type: none(),
  status: none(),
  defaultLanguage: {
    kind: "resolver",
    resolvedAgainst: "repository.ensureCreativeLanguages: the creative workspace's Language by code",
  },
  "languages[].code": {
    kind: "resolver",
    resolvedAgainst: "repository.ensureCreativeLanguages: the creative workspace's Language by code",
  },
  "languages[].enabled": none(),
  "content.label{}": localeKeys,
  "content.icon": none(),
  "content.message{}": localeKeys,
  "content.message{}[]": presentation,
  "content.button.label{}": localeKeys,
  "content.dismissible": none(),
  "content.accessibleName{}": localeKeys,
  styling: presentation,
  "destination.type": none(),
  "destination.surveyId": {
    kind: "fk",
    resolvedAgainst:
      "service.assertCreativeReferences: lockDestinationSurvey scoped by { id, workspaceId }, then getDestinationSurveyIssue",
  },
  "destination.url": none("an outbound link, opened in a new tab"),
  "distribution.showOn": none(),
  "distribution.triggers[].actionClassId": {
    kind: "fk",
    resolvedAgainst: "service.assertCreativeReferences: findWorkspaceActionClassIds scoped by workspaceId",
  },
  "distribution.conditions": presentation,
  "distribution.conditions.id": none("a condition group id the client chooses, local to the conditions"),
  "distribution.conditions.conditions[].id": none(
    "a condition id the client chooses, local to the conditions"
  ),
  "distribution.conditions.conditions[].conditions[].id": none(
    "a condition id the client chooses, local to the conditions"
  ),
  "distribution.displayPercentage": none(),
  "schedule.startAt": none(),
  "schedule.endAt": none(),
};
