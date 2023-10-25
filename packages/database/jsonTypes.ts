import { TActionClassNoCodeConfig } from "@formbricks/types/actionClasses";
import { TIntegrationConfig } from "@formbricks/types/integration";
import { TResponseData, TResponseMeta, TResponsePersonAttributes } from "@formbricks/types/responses";
import {
  TSurveyWelcomeCard,
  TSurveyClosedMessage,
  TSurveyHiddenFields,
  TSurveyProductOverwrites,
  TSurveyQuestions,
  TSurveySingleUse,
  TSurveyThankYouCard,
  TSurveyVerifyEmail,
} from "@formbricks/types/surveys";
import { TTeamSubscription } from "@formbricks/types/teams";
import { TUserNotificationSettings } from "@formbricks/types/users";

declare global {
  namespace PrismaJson {
    export type EventProperties = { [key: string]: string };
    export type EventClassNoCodeConfig = TActionClassNoCodeConfig;
    export type IntegrationConfig = TIntegrationConfig;
    export type ResponseData = TResponseData;
    export type ResponseMeta = TResponseMeta;
    export type ResponsePersonAttributes = TResponsePersonAttributes;
    export type welcomeCard = TSurveyWelcomeCard;
    export type SurveyQuestions = TSurveyQuestions;
    export type SurveyThankYouCard = TSurveyThankYouCard;
    export type SurveyHiddenFields = TSurveyHiddenFields;
    export type SurveyProductOverwrites = TSurveyProductOverwrites;
    export type SurveyClosedMessage = TSurveyClosedMessage;
    export type SurveySingleUse = TSurveySingleUse;
    export type SurveyVerifyEmail = TSurveyVerifyEmail;
    export type TeamSubscription = TTeamSubscription;
    export type UserNotificationSettings = TUserNotificationSettings;
  }
}
