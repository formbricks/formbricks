import "server-only";
import type { TSurveyType } from "@formbricks/types/surveys/types";
import type { TTemplate } from "@formbricks/types/templates";
import { isInternalI18nString, isPlainObject } from "../../guards";

export type TV3TemplateSurveyCreatePayload = {
  workspaceId: string;
  name: string;
  type: TSurveyType;
  status: "draft";
  // Canonical BCP-47 code of the survey's default language. Usually the creator's UI locale, but the
  // workspace default language (which may be any configured survey language) takes precedence.
  defaultLanguage: string;
  languages: [];
  metadata: unknown;
  welcomeCard: unknown;
  blocks: unknown[];
  endings: unknown[];
  hiddenFields: unknown;
  variables: unknown[];
};

function toPublicLocaleMap(value: Record<string, string>, defaultLanguage: string): Record<string, string> {
  return {
    [defaultLanguage]: value.default,
  };
}

function toV3PublicValue(value: unknown, defaultLanguage: string): unknown {
  if (isInternalI18nString(value)) {
    return toPublicLocaleMap(value, defaultLanguage);
  }

  if (Array.isArray(value)) {
    return value.map((entry) => toV3PublicValue(entry, defaultLanguage));
  }

  if (!isPlainObject(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([, entry]) => entry !== undefined)
      .map(([key, entry]) => [key, toV3PublicValue(entry, defaultLanguage)])
  );
}

export function buildV3SurveyCreatePayloadFromTemplate({
  template,
  workspaceId,
  surveyType,
  defaultLanguage,
}: {
  template: TTemplate;
  workspaceId: string;
  surveyType: TSurveyType;
  defaultLanguage: string;
}): TV3TemplateSurveyCreatePayload {
  return {
    workspaceId,
    name: template.preset.name,
    type: surveyType,
    status: "draft",
    defaultLanguage,
    languages: [],
    metadata: toV3PublicValue(template.preset.metadata ?? {}, defaultLanguage),
    welcomeCard: toV3PublicValue(template.preset.welcomeCard, defaultLanguage),
    blocks: toV3PublicValue(template.preset.blocks, defaultLanguage) as unknown[],
    endings: toV3PublicValue(template.preset.endings, defaultLanguage) as unknown[],
    hiddenFields: template.preset.hiddenFields,
    variables: toV3PublicValue(template.preset.variables ?? [], defaultLanguage) as unknown[],
  };
}
