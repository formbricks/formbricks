/* eslint-disable @typescript-eslint/no-namespace -- using namespaces is required for prisma-json-types-generator */
import { type TActionClassNoCodeConfig } from "@formbricks/types/action-classes";
import { type TIntegrationConfig } from "@formbricks/types/integration";
import { type TOrganizationBilling } from "@formbricks/types/organizations";
import { type TProductConfig, type TProductStyling } from "@formbricks/types/product";
import {
  type TResponseData,
  type TResponseMeta,
  type TResponsePersonAttributes,
} from "@formbricks/types/responses";
import { type TBaseFilters } from "@formbricks/types/segment";
import {
  type TSurveyClosedMessage,
  type TSurveyEnding,
  type TSurveyHiddenFields,
  type TSurveyProductOverwrites,
  type TSurveyQuestions,
  type TSurveySingleUse,
  type TSurveyStyling,
  type TSurveyVariables,
  type TSurveyWelcomeCard,
} from "@formbricks/types/surveys/types";
import { type TUserNotificationSettings } from "@formbricks/types/user";

declare global {
  namespace PrismaJson {
    export type ActionProperties = Record<string, string>;
    export type ActionClassNoCodeConfig = TActionClassNoCodeConfig;
    export type IntegrationConfig = TIntegrationConfig;
    export type ProductConfig = TProductConfig;
    export type ResponseData = TResponseData;
    export type ResponseMeta = TResponseMeta;
    export type ResponsePersonAttributes = TResponsePersonAttributes;
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
  }
}
