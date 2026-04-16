/* eslint-disable import/no-relative-packages -- required for importing types */
/* eslint-disable @typescript-eslint/no-namespace -- using namespaces is required for prisma-json-types-generator */
import { type TActionClassNoCodeConfig } from "../types/action-classes";
import type { TChartConfig, TChartQuery, TWidgetLayout } from "../types/analysis";
import type { TOrganizationAccess } from "../types/api-key";
import { type TIntegrationConfig } from "../types/integration";
import {
  type TOrganizationBilling,
  type TOrganizationBillingPlanLimits,
  type TOrganizationStripeBilling,
} from "../types/organizations";
import type { TSurveyQuotaLogic } from "../types/quota";
import { type TResponseContactAttributes, type TResponseData, type TResponseMeta } from "../types/responses";
import { type TBaseFilters } from "../types/segment";
import { type TSurveyBlocks } from "../types/surveys/blocks";
import {
  type TSurveyClosedMessage,
  type TSurveyEnding,
  type TSurveyHiddenFields,
  type TSurveyMetadata,
  type TSurveyQuestions,
  type TSurveyRecaptcha,
  type TSurveySingleUse,
  type TSurveyStyling,
  type TSurveyVariables,
  type TSurveyWelcomeCard,
  type TSurveyWorkspaceOverwrites,
} from "../types/surveys/types";
import type { TUserLocale, TUserNotificationSettings } from "../types/user";
import { type TWorkspaceConfig, type TWorkspaceStyling } from "../types/workspace";
import type { TSurveyFollowUpAction, TSurveyFollowUpTrigger } from "./types/survey-follow-up";

declare global {
  namespace PrismaJson {
    export type ActionProperties = Record<string, string>;
    export type ActionClassNoCodeConfig = TActionClassNoCodeConfig;
    export type IntegrationConfig = TIntegrationConfig;
    export type WorkspaceConfig = TWorkspaceConfig;
    export type ResponseData = TResponseData;
    export type ResponseMeta = TResponseMeta;
    export type ResponseContactAttributes = TResponseContactAttributes;
    export type SurveyWelcomeCard = TSurveyWelcomeCard;
    export type SurveyQuestions = TSurveyQuestions;
    export type SurveyBlocks = TSurveyBlocks;
    export type SurveyEnding = TSurveyEnding;
    export type SurveyHiddenFields = TSurveyHiddenFields;
    export type SurveyVariables = TSurveyVariables;
    export type SurveyWorkspaceOverwrites = TSurveyWorkspaceOverwrites;
    export type SurveyStyling = TSurveyStyling;
    export type SurveyClosedMessage = TSurveyClosedMessage;
    export type SurveySingleUse = TSurveySingleUse;
    export type SurveyRecaptcha = TSurveyRecaptcha;
    export type OrganizationBilling = TOrganizationBilling;
    export type OrganizationBillingPlanLimits = TOrganizationBillingPlanLimits;
    export type OrganizationStripeBilling = TOrganizationStripeBilling;
    export type UserNotificationSettings = TUserNotificationSettings;
    export type SegmentFilter = TBaseFilters;
    export type Styling = TWorkspaceStyling;
    export type Locale = TUserLocale;
    export type SurveyFollowUpTrigger = TSurveyFollowUpTrigger;
    export type SurveyFollowUpAction = TSurveyFollowUpAction;
    export type OrganizationAccess = TOrganizationAccess;
    export type SurveyMetadata = TSurveyMetadata;
    export type SurveyQuotaLogic = TSurveyQuotaLogic;
    export type ChartQuery = TChartQuery;
    export type ChartConfig = TChartConfig;
    export type WidgetLayout = TWidgetLayout;
  }
}
