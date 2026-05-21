import type { TSurvey as TInternalSurvey } from "@formbricks/types/surveys/types";
import type { TSurvey as TSurveyListRecord } from "@/modules/survey/list/types/surveys";
import {
  type TV3SurveyLanguage,
  getV3SurveyDefaultLanguage,
  getV3SurveyLanguages,
  normalizeV3SurveyLanguageTag,
  resolveV3SurveyLanguageCode,
} from "./language";

export type TV3SurveyListItem = Omit<TSurveyListRecord, "singleUse">;
const DEFAULT_V3_SURVEY_LANGUAGE = "en-US";

type TSerializedValue =
  | string
  | number
  | boolean
  | null
  | TSerializedValue[]
  | { [key: string]: TSerializedValue };

export class V3SurveyLanguageError extends Error {
  constructor(
    message: string,
    readonly normalizedCode?: string
  ) {
    super(message);
    this.name = "V3SurveyLanguageError";
  }
}

export class V3SurveyUnsupportedShapeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "V3SurveyUnsupportedShapeError";
  }
}

/**
 * Keep the v3 API contract isolated from internal persistence naming.
 * Surveys are scoped by workspaceId.
 */
export function serializeV3SurveyListItem(survey: TSurveyListRecord): TV3SurveyListItem {
  const { singleUse: _omitSingleUse, ...rest } = survey;

  return rest;
}

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isI18nString(value: unknown): value is Record<string, string> {
  return (
    isPlainObject(value) &&
    typeof value.default === "string" &&
    Object.values(value).every((entry) => typeof entry === "string")
  );
}

function getI18nValueForLanguage(value: Record<string, string>, languageCode: string): string | undefined {
  if (typeof value[languageCode] === "string") {
    return value[languageCode];
  }

  const matchingKey = Object.keys(value).find(
    (key) => normalizeV3SurveyLanguageTag(key)?.toLowerCase() === languageCode.toLowerCase()
  );
  return matchingKey ? value[matchingKey] : undefined;
}

function serializeCanonicalValue(
  value: unknown,
  defaultLanguage: string,
  languageCodes: Set<string>,
  options?: { fallbackMissingTranslations?: boolean }
): TSerializedValue {
  if (isI18nString(value)) {
    const result: Record<string, string> = {
      [defaultLanguage]: value.default,
    };

    for (const languageCode of languageCodes) {
      const translatedValue = getI18nValueForLanguage(value, languageCode);
      if (languageCode !== defaultLanguage) {
        if (translatedValue !== undefined) {
          result[languageCode] = translatedValue;
        } else if (options?.fallbackMissingTranslations) {
          result[languageCode] = value.default;
        }
      }
    }

    if (!languageCodes.has(defaultLanguage)) {
      delete result[defaultLanguage];
    }

    return result;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => serializeCanonicalValue(entry, defaultLanguage, languageCodes, options));
  }

  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        serializeCanonicalValue(entry, defaultLanguage, languageCodes, options),
      ])
    );
  }

  return value as TSerializedValue;
}

function serializeMetadata(
  metadata: unknown,
  defaultLanguage: string,
  languageCodes: Set<string>,
  options?: { fallbackMissingTranslations?: boolean }
): TSerializedValue {
  if (!isPlainObject(metadata)) {
    return metadata as TSerializedValue;
  }

  const serializedMetadata: Record<string, TSerializedValue> = { ...metadata } as Record<
    string,
    TSerializedValue
  >;
  for (const key of ["title", "description"]) {
    if (metadata[key] !== undefined) {
      serializedMetadata[key] = serializeCanonicalValue(
        metadata[key],
        defaultLanguage,
        languageCodes,
        options
      );
    }
  }

  return serializedMetadata;
}

function resolveRequestedLanguage(languages: TV3SurveyLanguage[], language: string): string {
  const result = resolveV3SurveyLanguageCode(language, languages);

  if (!result.ok) {
    throw new V3SurveyLanguageError(result.message, result.normalizedCode);
  }

  return result.code;
}

function resolveRequestedLanguages(languages: TV3SurveyLanguage[], requestedLanguages?: string[]): string[] {
  if (!requestedLanguages) {
    return [];
  }

  return requestedLanguages.map((language) => resolveRequestedLanguage(languages, language));
}

export function serializeV3SurveyResource(survey: TInternalSurvey, options?: { lang?: string[] }) {
  if (Array.isArray(survey.questions) && survey.questions.length > 0) {
    throw new V3SurveyUnsupportedShapeError(
      "Legacy question-based surveys are not supported by the v3 survey management API"
    );
  }

  const defaultLanguage = getV3SurveyDefaultLanguage(survey, DEFAULT_V3_SURVEY_LANGUAGE);
  const languages = getV3SurveyLanguages(survey, DEFAULT_V3_SURVEY_LANGUAGE);
  const configuredLanguageCodes = new Set(languages.map((language) => language.code));
  const requestedLanguages = resolveRequestedLanguages(languages, options?.lang);
  const languageCodes = requestedLanguages.length > 0 ? new Set(requestedLanguages) : configuredLanguageCodes;
  const serializeValue = (value: unknown) =>
    serializeCanonicalValue(value, defaultLanguage, languageCodes, {
      fallbackMissingTranslations: requestedLanguages.length > 0,
    });

  return {
    id: survey.id,
    workspaceId: survey.workspaceId,
    createdAt: toIsoString(survey.createdAt),
    updatedAt: toIsoString(survey.updatedAt),
    name: survey.name,
    type: survey.type,
    status: survey.status,
    metadata: serializeMetadata(survey.metadata, defaultLanguage, languageCodes, {
      fallbackMissingTranslations: requestedLanguages.length > 0,
    }),
    defaultLanguage,
    languages,
    welcomeCard: serializeValue(survey.welcomeCard),
    blocks: serializeValue(survey.blocks),
    endings: serializeValue(survey.endings),
    hiddenFields: survey.hiddenFields,
    variables: survey.variables,
  };
}
