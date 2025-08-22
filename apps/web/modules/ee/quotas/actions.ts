"use server";

import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import { AuthenticatedActionClientCtx } from "@/lib/utils/action-client/types/context";
import {
  getOrganizationIdFromSurveyId,
  getProjectIdFromSurveyId,
  getSurveyIdFromQuotaId,
} from "@/lib/utils/helper";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";
import { getIsQuotasEnabled } from "@/modules/ee/license-check/lib/utils";
import { createQuota, deleteQuota, updateQuota } from "@/modules/ee/quotas/lib/quotas";
import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { OperationNotAllowedError } from "@formbricks/types/errors";
import { ZSurveyQuotaCreateInput, ZSurveyQuotaUpdateInput } from "@formbricks/types/quota";

const ZDeleteQuotaAction = z.object({
  quotaId: ZId,
});

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
      const isQuotasEnabled = await getIsQuotasEnabled();
      if (!isQuotasEnabled) {
        throw new OperationNotAllowedError("Quotas are not enabled");
      }

      const surveyId = await getSurveyIdFromQuotaId(parsedInput.quotaId);
      const organizationId = await getOrganizationIdFromSurveyId(surveyId);
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
            projectId: await getProjectIdFromSurveyId(surveyId),
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
      const isQuotasEnabled = await getIsQuotasEnabled();
      if (!isQuotasEnabled) {
        throw new OperationNotAllowedError("Quotas are not enabled");
      }

      const surveyId = await getSurveyIdFromQuotaId(parsedInput.quotaId);
      const organizationId = await getOrganizationIdFromSurveyId(surveyId);
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
            projectId: await getProjectIdFromSurveyId(surveyId),
            minPermission: "readWrite",
          },
        ],
      });

      ctx.auditLoggingCtx.organizationId = organizationId;
      const result = await updateQuota(parsedInput.quota, parsedInput.quotaId);
      ctx.auditLoggingCtx.quotaId = parsedInput.quotaId;
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
      const isQuotasEnabled = await getIsQuotasEnabled();
      if (!isQuotasEnabled) {
        throw new OperationNotAllowedError("Quotas are not enabled");
      }

      const organizationId = await getOrganizationIdFromSurveyId(parsedInput.quota.surveyId);
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
