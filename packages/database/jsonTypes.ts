import { TActionClassNoCodeConfig } from "@formbricks/types/v1/actionClasses";
import { TIntegrationConfig } from "@formbricks/types/v1/integrations";
import { TResponsePersonAttributes, TResponseData, TResponseMeta } from "@formbricks/types/v1/responses";
import {
  TSurveyClosedMessage,
  TSurveyProductOverwrites,
  TSurveyQuestions,
  TSurveySingleUse,
  TSurveyThankYouCard,
  TSurveyVerifyEmail,
} from "@formbricks/types/v1/surveys";
import { TUserNotificationSettings } from "@formbricks/types/v1/users";

declare global {
  namespace PrismaJson {
    export type EventProperties = { [key: string]: string };
    export type EventClassNoCodeConfig = TActionClassNoCodeConfig;
    export type IntegrationConfig = TIntegrationConfig;
    export type ResponseData = TResponseData;
    export type ResponseMeta = TResponseMeta;
    export type ResponsePersonAttributes = TResponsePersonAttributes;
    export type SurveyQuestions = TSurveyQuestions;
    export type SurveyThankYouCard = TSurveyThankYouCard;
    export type SurveyProductOverwrites = TSurveyProductOverwrites;
    export type SurveyClosedMessage = TSurveyClosedMessage;
    export type SurveySingleUse = TSurveySingleUse;
    export type SurveyVerifyEmail = TSurveyVerifyEmail;
    export type UserNotificationSettings = TUserNotificationSettings;
  }
}
