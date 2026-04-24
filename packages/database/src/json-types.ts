/* eslint-disable import/no-relative-packages -- required for importing types */
/* eslint-disable @typescript-eslint/no-namespace -- using namespaces is required for prisma-json-types-generator */
import { type TActionClassNoCodeConfig } from "@formbricks/types/action-classes";
import type { TOrganizationAccess } from "@formbricks/types/api-key";
import { type TIntegrationConfig } from "@formbricks/types/integration";
import {
  type TOrganizationBilling,
  type TOrganizationBillingPlanLimits,
  type TOrganizationStripeBilling,
  type TOrganizationWhitelabel,
} from "@formbricks/types/organizations";
import { type TLogo, type TProjectConfig, type TProjectStyling } from "@formbricks/types/project";
import type { TSurveyQuotaLogic } from "@formbricks/types/quota";
import {
  type TResponseContactAttributes,
  type TResponseData,
  type TResponseMeta,
  type TResponseTtc,
  type TResponseVariables,
} from "@formbricks/types/responses";
import { type TBaseFilters } from "@formbricks/types/segment";
import { type TSurveyBlocks } from "@formbricks/types/surveys/blocks";
import type { TSurveyFollowUpAction, TSurveyFollowUpTrigger } from "@formbricks/types/surveys/follow-up";
import {
  type TSurveyClosedMessage,
  type TSurveyEnding,
  type TSurveyHiddenFields,
  type TSurveyInlineTriggers,
  type TSurveyMetadata,
  type TSurveyProjectOverwrites,
  type TSurveyQuestions,
  type TSurveyRecaptcha,
  type TSurveySingleUse,
  type TSurveyStyling,
  type TSurveyVariables,
  type TSurveyWelcomeCard,
} from "@formbricks/types/surveys/types";
import type { TUserLocale, TUserNotificationSettings } from "@formbricks/types/user";

declare global {
  namespace PrismaJson {
    export type ActionProperties = Record<string, string>;
    export type ActionClassNoCodeConfig = TActionClassNoCodeConfig;
    export type IntegrationConfig = TIntegrationConfig;
    export type ProjectConfig = TProjectConfig;
    export type ResponseData = TResponseData;
    export type ResponseVariables = TResponseVariables;
    export type ResponseTtc = TResponseTtc;
    export type ResponseMeta = TResponseMeta;
    export type ResponseContactAttributes = TResponseContactAttributes;
    export type SurveyWelcomeCard = TSurveyWelcomeCard;
    export type SurveyQuestions = TSurveyQuestions;
    export type SurveyBlocks = TSurveyBlocks;
    export type SurveyEnding = TSurveyEnding;
    export type SurveyHiddenFields = TSurveyHiddenFields;
    export type SurveyVariables = TSurveyVariables;
    export type SurveyInlineTriggers = TSurveyInlineTriggers;
    export type SurveyProjectOverwrites = TSurveyProjectOverwrites;
    export type SurveyStyling = TSurveyStyling;
    export type SurveyClosedMessage = TSurveyClosedMessage;
    export type SurveySingleUse = TSurveySingleUse;
    export type SurveyRecaptcha = TSurveyRecaptcha;
    export type SurveyLinkMetadata = TSurveyMetadata;
    export type OrganizationBilling = TOrganizationBilling;
    export type OrganizationBillingPlanLimits = TOrganizationBillingPlanLimits;
    export type OrganizationStripeBilling = TOrganizationStripeBilling;
    export type OrganizationWhitelabel = TOrganizationWhitelabel;
    export type UserNotificationSettings = TUserNotificationSettings;
    export type SegmentFilter = TBaseFilters;
    export type Styling = TProjectStyling;
    export type Logo = TLogo;
    export type Locale = TUserLocale;
    export type SurveyFollowUpTrigger = TSurveyFollowUpTrigger;
    export type SurveyFollowUpAction = TSurveyFollowUpAction;
    export type OrganizationAccess = TOrganizationAccess;
    export type SurveyMetadata = TSurveyMetadata;
    export type SurveyQuotaLogic = TSurveyQuotaLogic;
  }
}

export type TPrismaJsonTypesLoaded = true;
export {};
