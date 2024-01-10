import { TActionClassNoCodeConfig } from "@formbricks/types/actionClasses";
import { TIntegrationConfig } from "@formbricks/types/integration";
import { TResponseData, TResponseMeta, TResponsePersonAttributes } from "@formbricks/types/responses";
import {
  TSurveyClosedMessage,
  TSurveyHiddenFields,
  TSurveyProductOverwrites,
  TSurveyQuestions,
  TSurveySingleUse,
  TSurveyStyling,
  TSurveyThankYouCard,
  TSurveyVerifyEmail,
  TSurveyWelcomeCard,
} from "@formbricks/types/surveys";
import { TTeamBilling } from "@formbricks/types/teams";
import { TUserNotificationSettings } from "@formbricks/types/user";
import { TBaseFilterGroup } from "@formbricks/types/userSegment";

declare global {
  namespace PrismaJson {
    export type ActionProperties = { [key: string]: string };
    export type ActionClassNoCodeConfig = TActionClassNoCodeConfig;
    export type IntegrationConfig = TIntegrationConfig;
    export type ResponseData = TResponseData;
    export type ResponseMeta = TResponseMeta;
    export type ResponsePersonAttributes = TResponsePersonAttributes;
    export type welcomeCard = TSurveyWelcomeCard;
    export type SurveyQuestions = TSurveyQuestions;
    export type SurveyThankYouCard = TSurveyThankYouCard;
    export type SurveyHiddenFields = TSurveyHiddenFields;
    export type SurveyProductOverwrites = TSurveyProductOverwrites;
    export type SurveyStyling = TSurveyStyling;
    export type SurveyClosedMessage = TSurveyClosedMessage;
    export type SurveySingleUse = TSurveySingleUse;
    export type SurveyVerifyEmail = TSurveyVerifyEmail;
    export type TeamBilling = TTeamBilling;
    export type UserNotificationSettings = TUserNotificationSettings;
    export type UserSegmentFilter = TBaseFilterGroup;
  }
}
