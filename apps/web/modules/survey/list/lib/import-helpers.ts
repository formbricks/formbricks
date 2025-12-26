import { TSurveyCreateInput } from "@formbricks/types/surveys/types";
import { iso639Languages } from "@/lib/i18n/utils";
import { getOrganizationIdFromEnvironmentId } from "@/lib/utils/helper";
import { checkMultiLanguagePermission } from "@/modules/ee/multi-language-surveys/lib/actions";
import { getSurveyFollowUpsPermission } from "@/modules/survey/follow-ups/lib/utils";
import { checkSpamProtectionPermission } from "@/modules/survey/lib/permission";
import { getOrganizationBilling } from "@/modules/survey/lib/survey";
import { type TExportedLanguage, type TExportedTrigger } from "./export-survey";
import {
  type TMappedTrigger,
  type TSurveyLanguageConnection,
  mapLanguages,
  mapTriggers,
  normalizeLanguagesForCreation,
  resolveImportCapabilities,
  stripUnavailableFeatures as stripFeatures,
} from "./import";

export const getLanguageNames = (languageCodes: string[]): string[] => {
  return languageCodes.map((code) => {
    const language = iso639Languages.find((lang) => lang.alpha2 === code);
    return language ? language.label["en-US"] : code;
  });
};

export const mapExportedLanguagesToPrismaCreate = async (
  exportedLanguages: TExportedLanguage[],
  projectId: string
): Promise<TSurveyLanguageConnection | undefined> => {
  const result = await mapLanguages(exportedLanguages, projectId);
  return normalizeLanguagesForCreation(result.mapped);
};

export const mapOrCreateActionClasses = async (
  importedTriggers: TExportedTrigger[],
  environmentId: string
): Promise<TMappedTrigger[]> => {
  const result = await mapTriggers(importedTriggers, environmentId);
  return result.mapped;
};

export const stripUnavailableFeatures = async (
  survey: TSurveyCreateInput,
  environmentId: string
): Promise<TSurveyCreateInput> => {
  const organizationId = await getOrganizationIdFromEnvironmentId(environmentId);
  const capabilities = await resolveImportCapabilities(organizationId);
  return stripFeatures(survey, capabilities);
};

export const buildImportWarnings = async (
  survey: TSurveyCreateInput,
  organizationId: string
): Promise<string[]> => {
  const warnings: string[] = [];

  if (survey.languages?.length) {
    try {
      await checkMultiLanguagePermission(organizationId);
    } catch (e) {
      warnings.push("import_warning_multi_language");
    }
  }

  if (survey.followUps?.length) {
    let hasFollowUps = false;
    try {
      const organizationBilling = await getOrganizationBilling(organizationId);
      if (organizationBilling) {
        hasFollowUps = await getSurveyFollowUpsPermission(organizationBilling.plan);
      }
    } catch (e) {}
    if (!hasFollowUps) {
      warnings.push("import_warning_follow_ups");
    }
  }

  if (survey.recaptcha?.enabled) {
    try {
      await checkSpamProtectionPermission(organizationId);
    } catch (e) {
      warnings.push("import_warning_recaptcha");
    }
  }

  if (survey.segment) {
    warnings.push("import_warning_segments");
  }

  if (survey.triggers?.length) {
    warnings.push("import_warning_action_classes");
  }

  return warnings;
};

export const detectImagesInSurvey = (survey: TSurveyCreateInput): boolean => {
  if (survey.welcomeCard?.fileUrl || survey.welcomeCard?.videoUrl) return true;

  // Check blocks for images
  if (survey.blocks) {
    for (const block of survey.blocks) {
      for (const element of block.elements) {
        if (element.imageUrl || element.videoUrl) return true;
        if (element.type === "pictureSelection" && element.choices?.some((c) => c.imageUrl)) {
          return true;
        }
      }
    }
  }

  if (survey.endings && survey.endings.length > 0) {
    for (const e of survey.endings) {
      if (e.type === "endScreen" && (e.imageUrl || e.videoUrl)) return true;
    }
  }

  return false;
};
