import { TSurveyCreateInput } from "@formbricks/types/surveys/types";
import { addMultiLanguageLabels } from "@/lib/i18n/utils";
import { structuredClone } from "@/lib/pollyfills/structuredClone";
import { type TMappedLanguage } from "./map-languages";
import { type TImportCapabilities } from "./permissions";

export const stripUnavailableFeatures = (
  survey: TSurveyCreateInput,
  capabilities: TImportCapabilities
): TSurveyCreateInput => {
  const cloned = structuredClone(survey);

  if (!capabilities.hasMultiLanguage) {
    cloned.languages = [];
  }

  if (!capabilities.hasFollowUps) {
    cloned.followUps = [];
  }

  if (!capabilities.hasRecaptcha) {
    cloned.recaptcha = null;
  }

  delete cloned.segment;

  return cloned;
};

export interface TSurveyLanguageConnection {
  create: { languageId: string; enabled: boolean; default: boolean }[];
}

export const normalizeLanguagesForCreation = (
  languages: TMappedLanguage[]
): TSurveyLanguageConnection | undefined => {
  if (!languages || languages.length === 0) {
    return undefined;
  }

  return {
    create: languages.map((lang) => ({
      languageId: lang.languageId,
      enabled: lang.enabled,
      default: lang.default,
    })),
  };
};

export const addLanguageLabels = (
  survey: TSurveyCreateInput,
  languageCodes: string[]
): TSurveyCreateInput => {
  if (!languageCodes || languageCodes.length === 0) {
    return survey;
  }

  const cloned = structuredClone(survey);
  return addMultiLanguageLabels(cloned, languageCodes);
};
