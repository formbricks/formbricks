import { TSurveyCreateInput } from "@formbricks/types/surveys/types";

export const detectImagesInSurvey = (survey: any): boolean => {
  if (survey?.questions) {
    for (const question of survey.questions) {
      // Check for image fields in various question types
      if (question.imageUrl || question.videoUrl || question.fileUrl) {
        return true;
      }
      // Check for images in options
      if (question.options) {
        for (const option of question.options) {
          if (option.imageUrl) {
            return true;
          }
        }
      }
    }
  }

  // Check welcome card
  if (survey?.welcomeCard?.fileUrl) {
    return true;
  }

  // Check endings
  if (survey?.endings) {
    for (const ending of survey.endings) {
      if (ending.imageUrl || ending.videoUrl) {
        return true;
      }
    }
  }

  return false;
};

export const stripEnterpriseFeatures = (
  survey: any,
  permissions: {
    hasMultiLanguage: boolean;
    hasFollowUps: boolean;
    hasRecaptcha: boolean;
  }
): any => {
  const cleanedSurvey = { ...survey };

  // Strip multi-language if not permitted
  if (!permissions.hasMultiLanguage) {
    cleanedSurvey.languages = [
      {
        language: {
          code: "en",
          alias: "English",
        },
        default: true,
        enabled: true,
      },
    ];
    cleanedSurvey.showLanguageSwitch = false;
  }

  // Strip follow-ups if not permitted
  if (!permissions.hasFollowUps) {
    cleanedSurvey.followUps = [];
  }

  // Strip recaptcha if not permitted
  if (!permissions.hasRecaptcha) {
    cleanedSurvey.recaptcha = null;
  }

  return cleanedSurvey;
};

export const getImportWarnings = (
  survey: any,
  hasImages: boolean,
  permissions: {
    hasMultiLanguage: boolean;
    hasFollowUps: boolean;
    hasRecaptcha: boolean;
  }
): string[] => {
  const warnings: string[] = [];

  if (!permissions.hasMultiLanguage && survey?.languages?.length > 1) {
    warnings.push("import_warning_multi_language");
  }

  if (!permissions.hasFollowUps && survey?.followUps?.length) {
    warnings.push("import_warning_follow_ups");
  }

  if (!permissions.hasRecaptcha && survey?.recaptcha?.enabled) {
    warnings.push("import_warning_recaptcha");
  }

  if (hasImages) {
    warnings.push("import_warning_images");
  }

  if (survey?.segment) {
    warnings.push("import_warning_segments");
  }

  return warnings;
};
