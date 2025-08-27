"use server";

import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import { AuthenticatedActionClientCtx } from "@/lib/utils/action-client/types/context";
import { getOrganizationIdFromSurveyId, getProjectIdFromSurveyId } from "@/lib/utils/helper";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";
import { getIsQuotasEnabled } from "@/modules/ee/license-check/lib/utils";
import { createQuota, deleteQuota, updateQuota } from "@/modules/ee/quotas/lib/quotas";
import { getOrganizationBilling } from "@/modules/survey/lib/survey";
import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { OperationNotAllowedError } from "@formbricks/types/errors";
import { ZSurveyQuotaCreateInput, ZSurveyQuotaUpdateInput } from "@formbricks/types/quota";

const ZDeleteQuotaAction = z.object({
  quotaId: ZId,
  surveyId: ZId,
});

const checkQuotasEnabled = async (organizationId: string) => {
  const organizationBilling = await getOrganizationBilling(organizationId);
  if (!organizationBilling) {
    throw new Error("Organization billing not found");
  }
  const isQuotasEnabled = await getIsQuotasEnabled(organizationBilling.plan);
  if (!isQuotasEnabled) {
    throw new OperationNotAllowedError("Quotas are not enabled");
  }
};

export const deleteQuotaAction = authenticatedActionClient.schema(ZDeleteQuotaAction).action(
  withAuditLogging(
    "deleted",
    "quota",
    async ({
      ctx,
      parsedInput,
    }: {
      ctx: AuthenticatedActionClientCtx;
      parsedInput: z.infer<typeof ZDeleteQuotaAction>;
    }) => {
      const organizationId = await getOrganizationIdFromSurveyId(parsedInput.surveyId);
      await checkQuotasEnabled(organizationId);
      await checkAuthorizationUpdated({
        userId: ctx.user.id,
        organizationId,
        access: [
          {
            type: "organization",
            roles: ["owner", "manager"],
          },
          {
            type: "projectTeam",
            projectId: await getProjectIdFromSurveyId(parsedInput.surveyId),
            minPermission: "readWrite",
          },
        ],
      });

      ctx.auditLoggingCtx.organizationId = organizationId;
      ctx.auditLoggingCtx.quotaId = parsedInput.quotaId;

      const result = await deleteQuota(parsedInput.quotaId);

      ctx.auditLoggingCtx.oldObject = result;
      return result;
    }
  )
);

const ZUpdateQuotaAction = z.object({
  quotaId: ZId,
  quota: ZSurveyQuotaUpdateInput,
});

export const updateQuotaAction = authenticatedActionClient.schema(ZUpdateQuotaAction).action(
  withAuditLogging(
    "updated",
    "quota",
    async ({
      ctx,
      parsedInput,
    }: {
      ctx: AuthenticatedActionClientCtx;
      parsedInput: z.infer<typeof ZUpdateQuotaAction>;
    }) => {
      const organizationId = await getOrganizationIdFromSurveyId(parsedInput.quota.surveyId);
      await checkQuotasEnabled(organizationId);
      await checkAuthorizationUpdated({
        userId: ctx.user.id,
        organizationId,
        access: [
          {
            type: "organization",
            roles: ["owner", "manager"],
          },
          {
            type: "projectTeam",
            projectId: await getProjectIdFromSurveyId(parsedInput.quota.surveyId),
            minPermission: "readWrite",
          },
        ],
      });

      ctx.auditLoggingCtx.organizationId = organizationId;
      const result = await updateQuota(parsedInput.quota, parsedInput.quotaId);
      ctx.auditLoggingCtx.quotaId = parsedInput.quotaId;
      ctx.auditLoggingCtx.oldObject = parsedInput.quota;
      ctx.auditLoggingCtx.newObject = result;
      return result;
    }
  )
);

const ZCreateQuotaAction = z.object({
  quota: ZSurveyQuotaCreateInput,
});

export const createQuotaAction = authenticatedActionClient.schema(ZCreateQuotaAction).action(
  withAuditLogging(
    "created",
    "quota",
    async ({
      ctx,
      parsedInput,
    }: {
      ctx: AuthenticatedActionClientCtx;
      parsedInput: z.infer<typeof ZCreateQuotaAction>;
    }) => {
      const organizationId = await getOrganizationIdFromSurveyId(parsedInput.quota.surveyId);
      await checkQuotasEnabled(organizationId);
      await checkAuthorizationUpdated({
        userId: ctx.user.id,
        organizationId,
        access: [
          {
            type: "organization",
            roles: ["owner", "manager"],
          },
          {
            type: "projectTeam",
            projectId: await getProjectIdFromSurveyId(parsedInput.quota.surveyId),
            minPermission: "readWrite",
          },
        ],
      });

      ctx.auditLoggingCtx.organizationId = organizationId;
      const result = await createQuota(parsedInput.quota);
      ctx.auditLoggingCtx.quotaId = result.id;
      ctx.auditLoggingCtx.newObject = result;
      return result;
    }
  )
);
