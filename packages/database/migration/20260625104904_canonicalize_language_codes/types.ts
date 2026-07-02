// Row shapes read from the database during the language-code canonicalization migration.

export interface LanguageRow {
  id: string;
  code: string;
  alias: string | null;
  workspaceId: string;
  createdAt: Date;
}

export interface SurveyLanguageRow {
  languageId: string;
  surveyId: string;
  default: boolean;
  enabled: boolean;
}

export interface SurveyContentRow {
  id: string;
  welcomeCard: unknown;
  blocks: unknown[];
  endings: unknown[];
  metadata: unknown;
  surveyClosedMessage: unknown;
  questions: unknown;
}

// A `Language` row whose code only needs relabelling (no other row in the workspace collides on the
// canonical code), so a plain `UPDATE code = canonical` is safe.
export interface LanguageRelabel {
  id: string;
  toCode: string;
}

// A collision group: several `Language` rows in one workspace map to the same canonical code. One row
// survives (and is relabelled to canonical), the rest are absorbed into it and deleted.
export interface LanguageMerge {
  workspaceId: string;
  canonical: string;
  survivorId: string;
  survivorNeedsRelabel: boolean;
  // Alias to copy onto the survivor when it has none of its own (preserves user-entered aliases).
  aliasToSet: string | null;
  absorbedIds: string[];
}

export interface LanguageMergePlan {
  relabels: LanguageRelabel[];
  merges: LanguageMerge[];
}

// How to reconcile `SurveyLanguage` links when absorbed languages are merged into a survivor.
export interface SurveyLanguageMoves {
  // Absorbed link can move straight over: the survivor isn't linked to this survey yet.
  repoints: { surveyId: string; fromLanguageId: string }[];
  // Survivor already links this survey, so the absorbed link is dropped (composite PK forbids two).
  deletes: { surveyId: string; languageId: string }[];
  // Flags to bump on the survivor's existing link, carried over from a dropped absorbed link.
  flagUpdates: { surveyId: string; default: boolean; enabled: boolean }[];
}

export interface MigrationStats {
  languageRelabels: number;
  languageMerges: number;
  languagesDeleted: number;
  surveyLanguageRepoints: number;
  surveyLanguageDeletes: number;
  surveysContentUpdated: number;
  i18nKeysRewritten: number;
  responsesUpdated: number;
  responseContactAttributesUpdated: number;
  contactAttributesUpdated: number;
  unresolvedCodes: Set<string>;
}
