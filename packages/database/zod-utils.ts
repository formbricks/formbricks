import z from "zod";

export const ZEventProperties = z.record(z.string());
export { ZActionClassNoCodeConfig } from "@formbricks/types/actionClasses";
export { ZIntegrationConfig } from "@formbricks/types/integration";

export { ZResponseData, ZResponsePersonAttributes, ZResponseMeta } from "@formbricks/types/responses";

export {
  ZSurveyWelcomeCard,
  ZSurveyQuestions,
  ZSurveyThankYouCard,
  ZSurveyHiddenFields,
  ZSurveyClosedMessage,
  ZSurveyProductOverwrites,
  ZSurveyVerifyEmail,
  ZSurveySingleUse,
} from "@formbricks/types/surveys";

export { ZTeamSubscription } from "@formbricks/types/teams";
export { ZUserNotificationSettings } from "@formbricks/types/users";
