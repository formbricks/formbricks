import "server-only";
import { logger } from "@formbricks/logger";
import { InvalidInputError } from "@formbricks/types/errors";
import { loggableAIError, mapV3AIError } from "@/app/api/v3/lib/ai-errors";
import {
  getV3AuthorizationActor,
  getV3SessionUserId,
  requireSessionWorkspaceAccess,
} from "@/app/api/v3/lib/auth";
import { mapV3ThrownError } from "@/app/api/v3/lib/errors";
import {
  problemBadGateway,
  problemForbidden,
  problemUnauthorized,
  problemUnprocessableContent,
  successResponse,
} from "@/app/api/v3/lib/response";
import type { TV3Authentication } from "@/app/api/v3/lib/types";
import { RedactedAIError } from "@/lib/ai/loggable-error";
import { assertOrganizationAIConfigured, getOrganizationAIConfig } from "@/lib/ai/service";
import { can } from "@/lib/authorization";
import { getOrganizationIdFromSurveyId } from "@/lib/utils/helper";
import {
  AI_TRANSLATION_OUTPUT_TOO_LONG,
  translateFields,
} from "@/modules/ee/ai-translation/lib/translate-fields";
import type { TAITranslationBody } from "../schemas";
import type { TAITranslationAvailabilityResource, TAITranslationResource } from "../serializers";

/**
 * AI translation for the survey editor's Manage translations dialog: whether it is available, and the
 * translation itself. Nothing is saved — the editor merges the texts into its draft — so neither call is
 * audited. The AI gates (plan, organization toggle, instance configuration) are checked after
 * authorization, so an unauthorized caller learns nothing about the organization.
 */

type TRequestContext = {
  authentication: TV3Authentication;
  requestId: string;
  instance: string;
};

const operationLog = ({ requestId }: TRequestContext) => logger.withContext({ requestId });

/**
 * `GET /api/internal/ai-translations/availability?surveyId=`: whether the survey's organization may use
 * AI translation, and if not, why. For anyone who may read the survey (`survey.read`); an unknown survey
 * answers the same 403 as one the caller can't read.
 */
export async function getAITranslationAvailabilityOperation({
  surveyId,
  ...context
}: TRequestContext & { surveyId: string }): Promise<Response> {
  const { authentication, requestId, instance } = context;
  const actor = getV3AuthorizationActor(authentication);
  if (actor?.type !== "user") return problemUnauthorized(requestId, "Session required", instance);

  try {
    if (!(await can(actor, "survey.read", { type: "survey", id: surveyId }))) {
      return problemForbidden(requestId, undefined, instance);
    }

    const aiConfig = await getOrganizationAIConfig(await getOrganizationIdFromSurveyId(surveyId));
    let availability: TAITranslationAvailabilityResource = { available: true };
    if (!aiConfig.isAISmartToolsEntitled) {
      availability = { available: false, reason: "not_in_plan" };
    } else if (!aiConfig.isAISmartToolsEnabled) {
      availability = { available: false, reason: "not_enabled" };
    } else if (!aiConfig.isInstanceConfigured) {
      availability = { available: false, reason: "instance_not_configured" };
    }

    return successResponse(availability, { requestId });
  } catch (error) {
    // A survey or organization deleted between the check and the lookup reads as the same 403.
    return mapV3ThrownError(error, {
      log: operationLog(context),
      requestId,
      instance,
      operation: "aiTranslations.availability",
    });
  }
}

/**
 * `POST /api/internal/ai-translations?workspaceId=`: translate a survey's default-language texts into
 * another language. Needs `workspace.write` and AI smart tools for the organization.
 *
 * - AI not in the plan or switched off → 403, AI not configured on the instance → 503, each with the
 *   code the editor's message is chosen by; provider quota exhausted → 429
 * - more text than one answer can hold → 422 `ai_output_too_long`, so the editor can say to translate
 *   in parts rather than retry
 * - any other provider failure → 502, logged without its message, which can carry the survey's text
 */
export async function translateSurveyFieldsOperation({
  workspaceId,
  body,
  ...context
}: TRequestContext & { workspaceId: string; body: TAITranslationBody }): Promise<Response> {
  const { authentication, requestId, instance } = context;

  const access = await requireSessionWorkspaceAccess(
    authentication,
    workspaceId,
    "readWrite",
    requestId,
    instance
  );
  if (access instanceof Response) return access;
  const userId = getV3SessionUserId(authentication);
  if (!userId) return problemUnauthorized(requestId, "Session required", instance);

  try {
    await assertOrganizationAIConfigured(access.organizationId);

    const translations = await translateFields({
      organizationId: access.organizationId,
      workspaceId: access.workspaceId,
      userId,
      fields: body.fields,
      sourceLanguage: body.sourceLanguage,
      targetLanguage: body.targetLanguage,
    });

    const resource: TAITranslationResource = { translations };
    return successResponse(resource, { requestId });
  } catch (error) {
    return translateFailure(error, { ...context, ...access });
  }
}

const translateFailure = (
  error: unknown,
  {
    requestId,
    instance,
    workspaceId,
    organizationId,
  }: TRequestContext & { workspaceId: string; organizationId: string }
): Response => {
  const log = logger.withContext({ requestId, workspaceId });

  if (error instanceof InvalidInputError && error.message === AI_TRANSLATION_OUTPUT_TOO_LONG) {
    return problemUnprocessableContent(requestId, "There is too much text to translate at once.", {
      instance,
      code: "ai_output_too_long",
    });
  }

  const aiResponse = mapV3AIError(error, {
    requestId,
    instance,
    workspaceId,
    organizationId,
    operation: "aiTranslations.translate",
  });
  if (aiResponse) return aiResponse;

  if (error instanceof RedactedAIError) {
    // Name, frames and provider status only: the message can repeat the survey's text or the model's output.
    log.error({ ...loggableAIError(error) }, "Failed to translate survey fields");
    return problemBadGateway(
      requestId,
      "The AI provider could not translate these texts. Try again.",
      instance
    );
  }

  return mapV3ThrownError(error, { log, requestId, instance, operation: "aiTranslations.translate" });
};
