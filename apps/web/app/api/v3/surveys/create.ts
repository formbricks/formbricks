import "server-only";
import type { TSurvey, TSurveyCreateInput } from "@formbricks/types/surveys/types";
import type { TV3Authentication } from "@/app/api/v3/lib/types";
import { getActionClasses } from "@/lib/actionClass/service";
import { getOrganizationByWorkspaceId } from "@/lib/organization/service";
import { createSurvey, getSurvey } from "@/lib/survey/service";
import { getElementsFromBlocks } from "@/lib/survey/utils";
import { getExternalUrlsPermission } from "@/modules/survey/lib/permission";
import { v3DistributionToScalars } from "./distribution";
import { type TV3SurveyLanguageRequest, ensureV3WorkspaceLanguages } from "./languages";
import { prepareV3SurveyCreate } from "./prepare";
import { V3SurveyReferenceValidationError } from "./reference-validation";
import type { TV3CreateSurveyBody } from "./schemas";
import {
  V3_CONTACTS_NOT_ENABLED_MESSAGE,
  assertV3SurveyTargetingFilterReferences,
  resolveV3ContactsEntitlement,
} from "./targeting";
import { resolveV3SurveyTriggers } from "./triggers";
import { getV3SurveyMediaInvalidParams } from "./validation";

export type TV3SurveyCreateOptions = {
  skipExternalUrlPermissionCheck?: boolean;
  surveyCreateInputOverrides?: Partial<TSurveyCreateInput>;
};

export class V3SurveyCreatePermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "V3SurveyCreatePermissionError";
  }
}

function getCreatedBy(authentication: TV3Authentication): string | null {
  if (authentication && "user" in authentication && authentication.user?.id) {
    return authentication.user.id;
  }

  return null;
}

function hasExternalUrlReferences(input: TV3CreateSurveyBody): boolean {
  const hasExternalEndingLink = input.endings.some((ending) => {
    if (ending.type === "endScreen") {
      return Boolean(ending.buttonLink);
    }

    return Boolean(ending.url);
  });
  const hasExternalCtaButton = getElementsFromBlocks(input.blocks).some(
    (element) => element.type === "cta" && element.buttonExternal
  );

  return hasExternalEndingLink || hasExternalCtaButton;
}

async function assertV3SurveyCreatePermissions(
  input: TV3CreateSurveyBody,
  organizationId?: string,
  options: Pick<TV3SurveyCreateOptions, "skipExternalUrlPermissionCheck"> = {}
): Promise<void> {
  if (options.skipExternalUrlPermissionCheck || !hasExternalUrlReferences(input)) {
    return;
  }

  const resolvedOrganizationId =
    organizationId ?? (await getOrganizationByWorkspaceId(input.workspaceId))?.id ?? null;
  if (!resolvedOrganizationId) {
    throw new V3SurveyCreatePermissionError(
      `Unable to verify external URL permissions for workspaceId '${input.workspaceId}'.`
    );
  }

  const isExternalUrlsAllowed = await getExternalUrlsPermission(resolvedOrganizationId);
  if (!isExternalUrlsAllowed) {
    throw new V3SurveyCreatePermissionError(
      "External URLs are not enabled for this organization. Upgrade to use external survey links."
    );
  }
}

function hasV3SurveyTargetingFilters(input: TV3CreateSurveyBody): boolean {
  return input.type === "app" && (input.targeting?.filters.length ?? 0) > 0;
}

/**
 * Contact targeting (segment filters) is an enterprise feature. Gate non-empty targeting before any
 * write so an unentitled request fails with a 403 instead of creating a survey it can't fully configure.
 */
async function assertV3SurveyTargetingPermission(
  input: TV3CreateSurveyBody,
  organizationId?: string
): Promise<void> {
  if (!hasV3SurveyTargetingFilters(input)) {
    return;
  }

  const { resolvedOrganizationId, isContactsEnabled } = await resolveV3ContactsEntitlement(
    input.workspaceId,
    organizationId
  );
  if (!resolvedOrganizationId) {
    throw new V3SurveyCreatePermissionError(
      `Unable to verify contact targeting permissions for workspaceId '${input.workspaceId}'.`
    );
  }
  if (!isContactsEnabled) {
    throw new V3SurveyCreatePermissionError(V3_CONTACTS_NOT_ENABLED_MESSAGE);
  }
}

/**
 * Map the app-only `distribution` block onto the create input. Display scalars carry concrete
 * defaults (matching the DB defaults), and triggers are resolved to full action-class objects.
 */
async function buildV3AppSurveyCreateFields(
  input: TV3CreateSurveyBody
): Promise<Partial<TSurveyCreateInput>> {
  const distribution = input.distribution;
  if (!distribution) {
    return {};
  }

  const fields: Partial<TSurveyCreateInput> = { ...v3DistributionToScalars(distribution), triggers: [] };

  if (distribution.triggers.length > 0) {
    const actionClasses = await getActionClasses(input.workspaceId);
    fields.triggers = resolveV3SurveyTriggers(distribution.triggers, actionClasses);
  }

  return fields;
}

/**
 * Finalize a freshly created app survey by re-reading it. `createSurvey` returns the survey BEFORE
 * its private segment is connected (the segment is linked in a separate, un-selected update) and
 * without the Decimal→number transform for displayPercentage, so the re-read makes the response carry
 * the connected segment — including any targeting filters, which `createSurvey` writes atomically at
 * creation time — and the numeric display fields.
 */
async function finalizeV3AppSurveyCreate(survey: TSurvey, input: TV3CreateSurveyBody): Promise<TSurvey> {
  if (input.type !== "app") {
    return survey;
  }

  return (await getSurvey(survey.id)) ?? survey;
}

export async function executeV3SurveyCreate(params: {
  input: TV3CreateSurveyBody;
  authentication: TV3Authentication;
  languageRequests: TV3SurveyLanguageRequest[];
  requestId?: string;
  surveyCreateInputOverrides?: Partial<TSurveyCreateInput>;
}) {
  const { input, authentication, languageRequests, requestId, surveyCreateInputOverrides } = params;
  const mediaInvalidParams = getV3SurveyMediaInvalidParams(input.blocks);
  if (mediaInvalidParams.length > 0) {
    throw new V3SurveyReferenceValidationError(mediaInvalidParams);
  }

  // Resolve/validate app distribution (incl. trigger ids) and targeting attribute-key references
  // before any DB write, so an invalid reference fails with a 422 instead of a partial write.
  const appCreateFields = input.type === "app" ? await buildV3AppSurveyCreateFields(input) : {};
  if (input.type === "app") {
    await assertV3SurveyTargetingFilterReferences(input.workspaceId, input.targeting?.filters ?? []);
  }

  const languages = await ensureV3WorkspaceLanguages(input.workspaceId, languageRequests, requestId);
  const surveyCreateInput: TSurveyCreateInput = {
    name: input.name,
    type: input.type,
    status: input.status,
    metadata: input.metadata,
    welcomeCard: input.welcomeCard,
    blocks: input.blocks,
    endings: input.endings,
    hiddenFields: input.hiddenFields,
    variables: input.variables,
    languages,
    questions: [],
    createdBy: getCreatedBy(authentication),
    ...appCreateFields,
    ...surveyCreateInputOverrides,
  };

  // App targeting filters are created atomically with the survey's private segment inside
  // `createSurvey` (a single transaction), so a failed targeting write can't leave a partial survey.
  const privateSegmentFilters = input.type === "app" ? (input.targeting?.filters ?? []) : [];
  const survey = await createSurvey(input.workspaceId, surveyCreateInput, privateSegmentFilters);

  return await finalizeV3AppSurveyCreate(survey, input);
}

export async function createV3Survey(
  input: TV3CreateSurveyBody,
  authentication: TV3Authentication,
  requestId?: string,
  organizationId?: string,
  options: TV3SurveyCreateOptions = {}
) {
  const preparation = prepareV3SurveyCreate(input);
  if (!preparation.ok) {
    throw new V3SurveyReferenceValidationError(preparation.validation.invalidParams);
  }

  await assertV3SurveyCreatePermissions(input, organizationId, options);
  await assertV3SurveyTargetingPermission(preparation.document, organizationId);

  return await executeV3SurveyCreate({
    input: preparation.document,
    authentication,
    languageRequests: preparation.languageRequests,
    requestId,
    surveyCreateInputOverrides: options.surveyCreateInputOverrides,
  });
}
