import { normalizeLanguageCode } from "@formbricks/i18n-utils/src/canonical";
import type { TSurvey as TInternalSurvey } from "@formbricks/types/surveys/types";
import type { TSurvey as TSurveyListRecord } from "@/modules/survey/list/types/surveys";
import { surveyToV3Distribution, surveyToV3Targeting } from "./distribution";
import { isInternalI18nString, isPlainObject } from "./guards";
import {
  type TV3SurveyResolverLanguage,
  getV3SurveyDefaultLanguage,
  getV3SurveyLanguages,
  getV3SurveyResolverLanguages,
  resolveV3SurveyLanguageCode,
} from "./language";
import { V3_SURVEY_TRANSLATABLE_METADATA_KEYS } from "./translation-fields";

export type TV3SurveyCreator = Pick<NonNullable<TSurveyListRecord["creator"]>, "name">;

type TV3SurveyListItemBase = Pick<
  TSurveyListRecord,
  | "id"
  | "name"
  | "workspaceId"
  | "type"
  | "status"
  | "publishOn"
  | "archivedAt"
  | "createdAt"
  | "updatedAt"
  | "responseCount"
>;

export type TV3SurveyListItem = TV3SurveyListItemBase & {
  creator: TV3SurveyCreator | null;
};

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

export function serializeV3SurveyCreator(creator: TSurveyListRecord["creator"]): TV3SurveyCreator | null {
  if (!creator) {
    return null;
  }

  return {
    name: creator.name,
  };
}

/**
 * Keep the v3 API contract isolated from internal persistence naming.
 * Surveys are scoped by workspaceId.
 */
export function serializeV3SurveyListItem(survey: TSurveyListRecord): TV3SurveyListItem {
  return {
    id: survey.id,
    name: survey.name,
    workspaceId: survey.workspaceId,
    type: survey.type,
    status: survey.status,
    publishOn: survey.publishOn,
    archivedAt: survey.archivedAt,
    createdAt: survey.createdAt,
    updatedAt: survey.updatedAt,
    responseCount: survey.responseCount,
    creator: serializeV3SurveyCreator(survey.creator),
  };
}

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function getI18nValueForLanguage(value: Record<string, string>, languageCode: string): string | undefined {
  if (typeof value[languageCode] === "string") {
    return value[languageCode];
  }

  const matchingKey = Object.keys(value).find(
    (key) => normalizeLanguageCode(key)?.toLowerCase() === languageCode.toLowerCase()
  );
  return matchingKey ? value[matchingKey] : undefined;
}

function serializeCanonicalValue(
  value: unknown,
  defaultLanguage: string,
  languageCodes: Set<string>,
  options?: { fallbackMissingTranslations?: boolean }
): TSerializedValue {
  if (isInternalI18nString(value)) {
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
  for (const key of V3_SURVEY_TRANSLATABLE_METADATA_KEYS) {
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

function resolveRequestedLanguage(languages: TV3SurveyResolverLanguage[], language: string): string {
  const result = resolveV3SurveyLanguageCode(language, languages);

  if (!result.ok) {
    throw new V3SurveyLanguageError(result.message, result.normalizedCode);
  }

  return result.code;
}

function resolveRequestedLanguages(
  languages: TV3SurveyResolverLanguage[],
  requestedLanguages?: string[]
): string[] {
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
  const resolverLanguages = getV3SurveyResolverLanguages(survey, DEFAULT_V3_SURVEY_LANGUAGE);
  const configuredLanguageCodes = new Set(languages.map((language) => language.code));
  const requestedLanguages = resolveRequestedLanguages(resolverLanguages, options?.lang);
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
    languages: languages.map(({ code, default: isDefault, enabled, alias }) => ({
      code,
      default: isDefault,
      enabled,
      ...(alias ? { alias } : {}),
    })),
    welcomeCard: serializeValue(survey.welcomeCard),
    blocks: serializeValue(survey.blocks),
    endings: serializeValue(survey.endings),
    hiddenFields: survey.hiddenFields,
    variables: survey.variables,
    // App-only runtime/distribution + targeting, via the shared survey→public mappers. Omitted
    // entirely for link surveys to keep the contract clean.
    ...(survey.type === "app"
      ? { distribution: surveyToV3Distribution(survey), targeting: surveyToV3Targeting(survey) }
      : {}),
  };
}
