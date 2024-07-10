import { TActionClassNoCodeConfig } from "@formbricks/types/action-classes";
import { TIntegrationConfig } from "@formbricks/types/integration";
import { TOrganizationBilling } from "@formbricks/types/organizations";
import { TProductConfig, TProductStyling } from "@formbricks/types/product";
import { TResponseData, TResponseMeta, TResponsePersonAttributes } from "@formbricks/types/responses";
import { TBaseFilters } from "@formbricks/types/segment";
import {
  TSurveyClosedMessage,
  TSurveyEndings,
  TSurveyHiddenFields,
  TSurveyProductOverwrites,
  TSurveyQuestions,
  TSurveySingleUse,
  TSurveyStyling,
  TSurveyVerifyEmail,
  TSurveyWelcomeCard,
} from "@formbricks/types/surveys/types";
import { TUserNotificationSettings } from "@formbricks/types/user";

declare global {
  namespace PrismaJson {
    export type ActionProperties = { [key: string]: string };
    export type ActionClassNoCodeConfig = TActionClassNoCodeConfig;
    export type IntegrationConfig = TIntegrationConfig;
    export type ProductConfig = TProductConfig;
    export type ResponseData = TResponseData;
    export type ResponseMeta = TResponseMeta;
    export type ResponsePersonAttributes = TResponsePersonAttributes;
    export type welcomeCard = TSurveyWelcomeCard;
    export type SurveyQuestions = TSurveyQuestions;
    export type SurveyEndings = TSurveyEndings;
    export type SurveyHiddenFields = TSurveyHiddenFields;
    export type SurveyProductOverwrites = TSurveyProductOverwrites;
    export type SurveyStyling = TSurveyStyling;
    export type SurveyClosedMessage = TSurveyClosedMessage;
    export type SurveySingleUse = TSurveySingleUse;
    export type SurveyVerifyEmail = TSurveyVerifyEmail;
    export type OrganizationBilling = TOrganizationBilling;
    export type UserNotificationSettings = TUserNotificationSettings;
    export type SegmentFilter = TBaseFilters;
    export type Styling = TProductStyling;
  }
}
