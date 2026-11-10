import type { TSurvey } from "@formbricks/types/surveys/types";

/** A survey's single-use link settings, as the share modal's Anonymous links tab switches them. */
export type TSurveySingleUseSettingsResource = {
  surveyId: string;
  enabled: boolean;
  isEncrypted: boolean;
};

export const serializeSurveySingleUseSettings = (
  survey: Pick<TSurvey, "id" | "singleUse">
): TSurveySingleUseSettingsResource => ({
  surveyId: survey.id,
  enabled: survey.singleUse?.enabled ?? false,
  isEncrypted: survey.singleUse?.isEncrypted ?? false,
});
