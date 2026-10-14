"use server";

import { z } from "zod";
import { OperationNotAllowedError } from "@formbricks/types/errors";
import { ZSurveySlug } from "@formbricks/types/surveys/types";
import { assertCan } from "@/lib/authorization";
import { IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { getOrganizationIdFromSurveyId, getWorkspaceIdFromSurveyId } from "@/lib/utils/helper";
import { applyRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";
import { updateSurveySlug } from "@/modules/survey/lib/slug";

const ZUpdateSurveySlugAction = z.object({
  surveyId: z.cuid2(),
  slug: ZSurveySlug,
});

export const updateSurveySlugAction = authenticatedActionClient.inputSchema(ZUpdateSurveySlugAction).action(
  withAuditLogging("updated", "survey", async ({ ctx, parsedInput }) => {
    ctx.auditLoggingCtx.surveyId = parsedInput.surveyId;
    if (IS_FORMBRICKS_CLOUD) {
      throw new OperationNotAllowedError("Pretty URLs are only available on self-hosted instances");
    }

    const workspaceId = await getWorkspaceIdFromSurveyId(parsedInput.surveyId);
    ctx.auditLoggingCtx.organizationId = await getOrganizationIdFromSurveyId(parsedInput.surveyId);
    await assertCan({ type: "user", id: ctx.user.id }, "survey.write", {
      type: "survey",
      id: parsedInput.surveyId,
    });
    await applyRateLimit(rateLimitConfigs.actions.stateMutation, workspaceId);

    const result = await updateSurveySlug(parsedInput.surveyId, parsedInput.slug);
    // Whether a slug is set, never the slug itself.
    ctx.auditLoggingCtx.newObject = { slugSet: true };
    return result;
  })
);

const ZRemoveSurveySlugAction = z.object({
  surveyId: z.cuid2(),
});

export const removeSurveySlugAction = authenticatedActionClient.inputSchema(ZRemoveSurveySlugAction).action(
  withAuditLogging("updated", "survey", async ({ ctx, parsedInput }) => {
    ctx.auditLoggingCtx.surveyId = parsedInput.surveyId;
    if (IS_FORMBRICKS_CLOUD) {
      throw new OperationNotAllowedError("Pretty URLs are only available on self-hosted instances");
    }

    const workspaceId = await getWorkspaceIdFromSurveyId(parsedInput.surveyId);
    ctx.auditLoggingCtx.organizationId = await getOrganizationIdFromSurveyId(parsedInput.surveyId);
    await assertCan({ type: "user", id: ctx.user.id }, "survey.write", {
      type: "survey",
      id: parsedInput.surveyId,
    });
    await applyRateLimit(rateLimitConfigs.actions.stateMutation, workspaceId);

    const result = await updateSurveySlug(parsedInput.surveyId, null);
    // Whether a slug is set, never the slug itself.
    ctx.auditLoggingCtx.newObject = { slugSet: false };
    return result;
  })
);
