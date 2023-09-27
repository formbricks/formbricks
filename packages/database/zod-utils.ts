import z from "zod";

export const ZEventProperties = z.record(z.string());
export { ZActionClassNoCodeConfig } from "@formbricks/types/v1/actionClasses";
export { ZIntegrationConfig } from "@formbricks/types/v1/integrations";

export { ZResponseData, ZResponsePersonAttributes, ZResponseMeta } from "@formbricks/types/v1/responses";

export {
  ZSurveyQuestions,
  ZSurveyThankYouCard,
  ZSurveyClosedMessage,
  ZSurveyVerifyEmail,
} from "@formbricks/types/v1/surveys";

export { ZUserNotificationSettings } from "@formbricks/types/v1/users";

export { ZTeamSubscription } from "@formbricks/types/v1/teams";
