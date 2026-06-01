/* eslint-disable @typescript-eslint/ban-types, @typescript-eslint/no-namespace, import/export, no-redeclare -- Prisma facade mirrors @prisma/client's merged value/namespace API. */
import type * as runtime from "@prisma/client/runtime/client";
import { Prisma as GeneratedPrisma, PrismaClient as GeneratedPrismaClient } from "../generated/prisma/client";
import type { PrismaClient as GeneratedPrismaClientType } from "../generated/prisma/client";
import type * as PrismaNamespaceTypes from "../generated/prisma/internal/prismaNamespace";
import type * as PrismaModelTypes from "../generated/prisma/models";

export const PrismaClient = GeneratedPrismaClient;
export type PrismaClient<
  LogOpts extends PrismaNamespaceTypes.LogLevel = never,
  OmitOpts extends PrismaNamespaceTypes.PrismaClientOptions["omit"] =
    PrismaNamespaceTypes.PrismaClientOptions["omit"],
  ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs,
> = GeneratedPrismaClientType<LogOpts, OmitOpts, ExtArgs>;
export * as $Enums from "../generated/prisma/enums";
export * from "../generated/prisma/enums";
export type * from "../generated/prisma/models";
export type {
  Webhook,
  ContactAttribute,
  ContactAttributeKey,
  Contact,
  Response,
  Tag,
  TagsOnResponses,
  Display,
  SurveyTrigger,
  SurveyAttributeFilter,
  Survey,
  SurveyQuota,
  ResponseQuotaLink,
  SurveyFollowUp,
  ActionClass,
  Integration,
  DataMigration,
  Workspace,
  Organization,
  OrganizationBilling,
  Membership,
  Invite,
  ApiKey,
  ApiKeyWorkspace,
  Account,
  Session,
  VerificationToken,
  PasswordResetToken,
  User,
  Segment,
  Language,
  SurveyLanguage,
  Team,
  TeamUser,
  WorkspaceTeam,
  Chart,
  Dashboard,
  DashboardWidget,
  Connector,
  ConnectorFormbricksMapping,
  ConnectorFieldMapping,
  FeedbackDirectory,
  FeedbackDirectoryWorkspace,
} from "../generated/prisma/client";
// Reaches into the generator's `internal/` path because Prisma 7's
// `prisma-client` provider does not re-export PrismaClientKnownRequestError
// from the public entrypoint. Revisit on every Prisma minor upgrade — the
// internal layout is not a stable surface.
export { PrismaClientKnownRequestError } from "../generated/prisma/internal/prismaNamespace";
export const Prisma = GeneratedPrisma;

export namespace Prisma {
  export type InputJsonValue = PrismaNamespaceTypes.InputJsonValue;
  export type JsonObject = PrismaNamespaceTypes.JsonObject;
  export type JsonValue = PrismaNamespaceTypes.JsonValue;
  export type PrismaPromise<T> = PrismaNamespaceTypes.PrismaPromise<T>;
  export type Result<T, A, F extends runtime.Operation> = PrismaNamespaceTypes.Result<T, A, F>;
  export type TransactionClient = PrismaNamespaceTypes.TransactionClient;
  export type TransactionIsolationLevel = PrismaNamespaceTypes.TransactionIsolationLevel;
  export type TypeMap<
    ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs,
    GlobalOmitOptions = {},
  > = PrismaNamespaceTypes.TypeMap<ExtArgs, GlobalOmitOptions>;
  export type ActionClassSelect = PrismaModelTypes.ActionClassSelect;
  export type ChartFindManyArgs = PrismaModelTypes.ChartFindManyArgs;
  export type ConnectorGetPayload<
    S extends boolean | null | undefined | PrismaModelTypes.ConnectorDefaultArgs,
  > = PrismaModelTypes.ConnectorGetPayload<S>;
  export type ConnectorSelect = PrismaModelTypes.ConnectorSelect;
  export type ContactAttributeKeyCreateInput = PrismaModelTypes.ContactAttributeKeyCreateInput;
  export type ContactAttributeKeyCreateWithoutWorkspaceInput =
    PrismaModelTypes.ContactAttributeKeyCreateWithoutWorkspaceInput;
  export type ContactAttributeKeyFindManyArgs = PrismaModelTypes.ContactAttributeKeyFindManyArgs;
  export type ContactAttributeKeyUpdateInput = PrismaModelTypes.ContactAttributeKeyUpdateInput;
  export type ContactAttributeSelect = PrismaModelTypes.ContactAttributeSelect;
  export type ContactGetPayload<S extends boolean | null | undefined | PrismaModelTypes.ContactDefaultArgs> =
    PrismaModelTypes.ContactGetPayload<S>;
  export type ContactInclude = PrismaModelTypes.ContactInclude;
  export type ContactSelect = PrismaModelTypes.ContactSelect;
  export type ContactWhereInput = PrismaModelTypes.ContactWhereInput;
  export type DashboardFindManyArgs = PrismaModelTypes.DashboardFindManyArgs;
  export type DateTimeFilter = PrismaModelTypes.DateTimeFilter;
  export type DateTimeNullableFilter = PrismaModelTypes.DateTimeNullableFilter;
  export type DisplaySelect = PrismaModelTypes.DisplaySelect;
  export type FeedbackDirectoryUpdateInput = PrismaModelTypes.FeedbackDirectoryUpdateInput;
  export type FeedbackDirectoryWorkspaceUpdateManyWithoutFeedbackDirectoryNestedInput =
    PrismaModelTypes.FeedbackDirectoryWorkspaceUpdateManyWithoutFeedbackDirectoryNestedInput;
  export type FloatNullableFilter = PrismaModelTypes.FloatNullableFilter;
  export type LanguageSelect = PrismaModelTypes.LanguageSelect;
  export type OrganizationBillingGetPayload<
    S extends boolean | null | undefined | PrismaModelTypes.OrganizationBillingDefaultArgs,
  > = PrismaModelTypes.OrganizationBillingGetPayload<S>;
  export type OrganizationBillingSelect = PrismaModelTypes.OrganizationBillingSelect;
  export type OrganizationGetPayload<
    S extends boolean | null | undefined | PrismaModelTypes.OrganizationDefaultArgs,
  > = PrismaModelTypes.OrganizationGetPayload<S>;
  export type OrganizationSelect = PrismaModelTypes.OrganizationSelect;
  export type PasswordResetTokenGetPayload<
    S extends boolean | null | undefined | PrismaModelTypes.PasswordResetTokenDefaultArgs,
  > = PrismaModelTypes.PasswordResetTokenGetPayload<S>;
  export type PasswordResetTokenSelect = PrismaModelTypes.PasswordResetTokenSelect;
  export type ResponseCreateInput = PrismaModelTypes.ResponseCreateInput;
  export type ResponseFindManyArgs = PrismaModelTypes.ResponseFindManyArgs;
  export type ResponseGetPayload<
    S extends boolean | null | undefined | PrismaModelTypes.ResponseDefaultArgs,
  > = PrismaModelTypes.ResponseGetPayload<S>;
  export type ResponseSelect = PrismaModelTypes.ResponseSelect;
  export type ResponseWhereInput = PrismaModelTypes.ResponseWhereInput;
  export type SegmentGetPayload<S extends boolean | null | undefined | PrismaModelTypes.SegmentDefaultArgs> =
    PrismaModelTypes.SegmentGetPayload<S>;
  export type SegmentSelect = PrismaModelTypes.SegmentSelect;
  export type SegmentUpdateInput = PrismaModelTypes.SegmentUpdateInput;
  export type StringFilter = PrismaModelTypes.StringFilter;
  export type SurveyCreateInput = PrismaModelTypes.SurveyCreateInput;
  export type SurveyGetPayload<S extends boolean | null | undefined | PrismaModelTypes.SurveyDefaultArgs> =
    PrismaModelTypes.SurveyGetPayload<S>;
  export type SurveyLanguageCreateNestedManyWithoutSurveyInput =
    PrismaModelTypes.SurveyLanguageCreateNestedManyWithoutSurveyInput;
  export type SurveyOrderByWithRelationInput = PrismaModelTypes.SurveyOrderByWithRelationInput;
  export type SurveySelect = PrismaModelTypes.SurveySelect;
  export type SurveyTriggerCreateWithoutSurveyInput = PrismaModelTypes.SurveyTriggerCreateWithoutSurveyInput;
  export type SurveyWhereInput = PrismaModelTypes.SurveyWhereInput;
  export type TeamFindManyArgs = PrismaModelTypes.TeamFindManyArgs;
  export type TeamUpdateInput = PrismaModelTypes.TeamUpdateInput;
  export type UserCreateInput = PrismaModelTypes.UserCreateInput;
  export type UserFindManyArgs = PrismaModelTypes.UserFindManyArgs;
  export type UserGetPayload<S extends boolean | null | undefined | PrismaModelTypes.UserDefaultArgs> =
    PrismaModelTypes.UserGetPayload<S>;
  export type UserSelect = PrismaModelTypes.UserSelect;
  export type UserUpdateInput = PrismaModelTypes.UserUpdateInput;
  export type WebhookCreateInput = PrismaModelTypes.WebhookCreateInput;
  export type WebhookFindManyArgs = PrismaModelTypes.WebhookFindManyArgs;
  export type WorkspaceGetPayload<
    S extends boolean | null | undefined | PrismaModelTypes.WorkspaceDefaultArgs,
  > = PrismaModelTypes.WorkspaceGetPayload<S>;
  export type WorkspaceTeamFindManyArgs = PrismaModelTypes.WorkspaceTeamFindManyArgs;
  export type WorkspaceWhereInput = PrismaModelTypes.WorkspaceWhereInput;
}
