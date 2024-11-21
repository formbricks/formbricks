/* eslint-disable import/no-relative-packages -- required for importing types */

/* eslint-disable @typescript-eslint/no-namespace -- using namespaces is required for prisma-json-types-generator */
import type { TActionClassNoCodeConfig } from "../types/action-classes";
import type { TIntegrationConfig } from "../types/integration";
import type { TOrganizationBilling } from "../types/organizations";
import type { TProductConfig, TProductStyling } from "../types/product";
import type { TResponseContactAttributes, TResponseData, TResponseMeta } from "../types/responses";
import type { TBaseFilters } from "../types/segment";
import type {
  TSurveyClosedMessage,
  TSurveyEnding,
  TSurveyHiddenFields,
  TSurveyProductOverwrites,
  TSurveyQuestions,
  TSurveySingleUse,
  TSurveyStyling,
  TSurveyVariables,
  TSurveyWelcomeCard,
} from "../types/surveys/types";
import type { TUserLocale, TUserNotificationSettings } from "../types/user";
import type { TSurveyFollowUpAction, TSurveyFollowUpTrigger } from "./types/survey-follow-up";

declare global {
  namespace PrismaJson {
    export type ActionProperties = Record<string, string>;
    export type ActionClassNoCodeConfig = TActionClassNoCodeConfig;
    export type IntegrationConfig = TIntegrationConfig;
    export type ProductConfig = TProductConfig;
    export type ResponseData = TResponseData;
    export type ResponseMeta = TResponseMeta;
    export type ResponseContactAttributes = TResponseContactAttributes;
    export type SurveyWelcomeCard = TSurveyWelcomeCard;
    export type SurveyQuestions = TSurveyQuestions;
    export type SurveyEnding = TSurveyEnding;
    export type SurveyHiddenFields = TSurveyHiddenFields;
    export type SurveyVariables = TSurveyVariables;
    export type SurveyProductOverwrites = TSurveyProductOverwrites;
    export type SurveyStyling = TSurveyStyling;
    export type SurveyClosedMessage = TSurveyClosedMessage;
    export type SurveySingleUse = TSurveySingleUse;
    export type OrganizationBilling = TOrganizationBilling;
    export type UserNotificationSettings = TUserNotificationSettings;
    export type SegmentFilter = TBaseFilters;
    export type Styling = TProductStyling;
    export type Locale = TUserLocale;
    export type SurveyFollowUpTrigger = TSurveyFollowUpTrigger;
    export type SurveyFollowUpAction = TSurveyFollowUpAction;
  }
}
