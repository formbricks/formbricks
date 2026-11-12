import type { TSurvey } from "@formbricks/types/surveys/types";

/**
 * A survey's single-use link settings, as the share modal's Anonymous links tab switches them. `updatedAt` is
 * the survey's after the write, so the page can hold the settings without an older server render undoing them.
 */
export type TSurveySingleUseSettingsResource = {
  surveyId: string;
  enabled: boolean;
  isEncrypted: boolean;
  updatedAt: Date;
};

export const serializeSurveySingleUseSettings = (
  survey: Pick<TSurvey, "id" | "singleUse" | "updatedAt">
): TSurveySingleUseSettingsResource => ({
  surveyId: survey.id,
  enabled: survey.singleUse?.enabled ?? false,
  isEncrypted: survey.singleUse?.isEncrypted ?? false,
  updatedAt: survey.updatedAt,
});
