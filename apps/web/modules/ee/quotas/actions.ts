"use server";

import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import { AuthenticatedActionClientCtx } from "@/lib/utils/action-client/types/context";
import { getOrganizationIdFromSurveyId } from "@/lib/utils/helper";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";
import { createQuota, deleteQuota, getQuotas, updateQuota } from "@/modules/ee/quotas/lib/quotas";
import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { ZSurveyQuotaCreateInput, ZSurveyQuotaUpdateInput } from "@formbricks/types/quota";

const ZGetQuotasAction = z.object({
  surveyId: ZId,
});

export const getQuotasAction = authenticatedActionClient
  .schema(ZGetQuotasAction)
  .action(
    async ({
      ctx,
      parsedInput,
    }: {
      ctx: AuthenticatedActionClientCtx;
      parsedInput: z.infer<typeof ZGetQuotasAction>;
    }) => {
      await checkAuthorizationUpdated({
        userId: ctx.user.id,
        organizationId: await getOrganizationIdFromSurveyId(parsedInput.surveyId),
        access: [
          {
            type: "organization",
            roles: ["owner", "manager"],
          },
        ],
      });

      return getQuotas(parsedInput.surveyId);
    }
  );

const ZDeleteQuotaAction = z.object({
  quotaId: ZId,
  surveyId: ZId,
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
      const organizationId = await getOrganizationIdFromSurveyId(parsedInput.surveyId);

      await checkAuthorizationUpdated({
        userId: ctx.user.id,
        organizationId,
        access: [
          {
            type: "organization",
            roles: ["owner", "manager"],
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
    "created",
    "quota",
    async ({
      ctx,
      parsedInput,
    }: {
      ctx: AuthenticatedActionClientCtx;
      parsedInput: z.infer<typeof ZUpdateQuotaAction>;
    }) => {
      const organizationId = await getOrganizationIdFromSurveyId(parsedInput.quota.surveyId);
      await checkAuthorizationUpdated({
        userId: ctx.user.id,
        organizationId,
        access: [
          {
            type: "organization",
            roles: ["owner", "manager"],
          },
        ],
      });

      ctx.auditLoggingCtx.organizationId = organizationId;
      const result = await updateQuota(parsedInput.quota, parsedInput.quotaId);
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
      await checkAuthorizationUpdated({
        userId: ctx.user.id,
        organizationId,
        access: [
          {
            type: "organization",
            roles: ["owner", "manager"],
          },
        ],
      });

      ctx.auditLoggingCtx.organizationId = organizationId;
      const result = await createQuota(parsedInput.quota);
      ctx.auditLoggingCtx.newObject = result;
      return result;
    }
  )
);
