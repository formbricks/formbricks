import { z } from "zod";

export const ZActionProperties = z.record(z.string());
export { ZActionClassNoCodeConfig } from "@formbricks/types/action-classes";
export { ZIntegrationConfig } from "@formbricks/types/integration";

export {
  ZResponseData,
  ZResponsePersonAttributes,
  ZResponseMeta,
  ZResponseTtc,
} from "@formbricks/types/responses";

export {
  ZSurveyWelcomeCard,
  ZSurveyQuestions,
  ZSurveyHiddenFields,
  ZSurveyVariables,
  ZSurveyClosedMessage,
  ZSurveyProductOverwrites,
  ZSurveyStyling,
  ZSurveySingleUse,
  ZSurveyInlineTriggers,
  ZSurveyEnding,
} from "@formbricks/types/surveys/types";

export { ZSegmentFilters } from "@formbricks/types/segment";
export { ZOrganizationBilling } from "@formbricks/types/organizations";
export { ZUserNotificationSettings } from "@formbricks/types/user";
