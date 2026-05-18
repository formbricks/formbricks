import type { TSurvey as TInternalSurvey } from "@formbricks/types/surveys/types";
import type { TSurvey as TSurveyListRecord } from "@/modules/survey/list/types/surveys";
import { normalizeV3SurveyLanguageTag, resolveV3SurveyLanguageCode } from "./language";

export type TV3SurveyListItem = Omit<TSurveyListRecord, "singleUse">;

type TV3SurveyLanguage = {
  code: string;
  default: boolean;
  enabled: boolean;
};

type TSerializedValue =
  | string
  | number
  | boolean
  | null
  | TSerializedValue[]
  | { [key: string]: TSerializedValue };

export class V3SurveyLanguageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "V3SurveyLanguageError";
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

function getSurveyLanguages(survey: TInternalSurvey): TV3SurveyLanguage[] {
  return (survey.languages ?? []).map((surveyLanguage) => ({
    code: normalizeV3SurveyLanguageTag(surveyLanguage.language.code) ?? surveyLanguage.language.code,
    default: surveyLanguage.default,
    enabled: surveyLanguage.enabled,
  }));
}

function getDefaultLanguage(survey: TInternalSurvey): string {
  const defaultLanguageCode = survey.languages?.find((surveyLanguage) => surveyLanguage.default)?.language
    .code;
  return defaultLanguageCode
    ? (normalizeV3SurveyLanguageTag(defaultLanguageCode) ?? defaultLanguageCode)
    : "default";
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

function serializeCanonicalValue(
  value: unknown,
  defaultLanguage: string,
  configuredLanguageCodes: Set<string>
): TSerializedValue {
  if (isI18nString(value)) {
    const result: Record<string, string> = {
      [defaultLanguage]: value.default,
    };

    for (const languageCode of configuredLanguageCodes) {
      if (languageCode !== defaultLanguage && typeof value[languageCode] === "string") {
        result[languageCode] = value[languageCode];
      }
    }

    return result;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => serializeCanonicalValue(entry, defaultLanguage, configuredLanguageCodes));
  }

  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        serializeCanonicalValue(entry, defaultLanguage, configuredLanguageCodes),
      ])
    );
  }

  return value as TSerializedValue;
}

function serializeLocalizedValue(value: unknown, language: string): TSerializedValue {
  if (isI18nString(value)) {
    return value[language] ?? value.default;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => serializeLocalizedValue(entry, language));
  }

  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, serializeLocalizedValue(entry, language)])
    );
  }

  return value as TSerializedValue;
}

function resolveRequestedLanguage(languages: TV3SurveyLanguage[], language: string): string {
  const result = resolveV3SurveyLanguageCode(language, languages);

  if (!result.ok) {
    throw new V3SurveyLanguageError(result.message);
  }

  return result.code;
}

export function serializeV3SurveyResource(survey: TInternalSurvey, options?: { lang?: string }) {
  const defaultLanguage = getDefaultLanguage(survey);
  const languages = getSurveyLanguages(survey);
  const configuredLanguageCodes = new Set(languages.map((language) => language.code));
  const language = options?.lang ? resolveRequestedLanguage(languages, options.lang) : undefined;

  const serializeValue = language
    ? (value: unknown) => serializeLocalizedValue(value, language)
    : (value: unknown) => serializeCanonicalValue(value, defaultLanguage, configuredLanguageCodes);

  return {
    id: survey.id,
    workspaceId: survey.workspaceId,
    createdAt: toIsoString(survey.createdAt),
    updatedAt: toIsoString(survey.updatedAt),
    name: survey.name,
    type: survey.type,
    status: survey.status,
    metadata: survey.metadata,
    defaultLanguage,
    ...(language ? { language } : {}),
    languages,
    welcomeCard: serializeValue(survey.welcomeCard),
    blocks: serializeValue(survey.blocks),
    endings: serializeValue(survey.endings),
    hiddenFields: survey.hiddenFields,
    variables: survey.variables,
  };
}
