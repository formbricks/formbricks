"use server";

import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { OperationNotAllowedError, ResourceNotFoundError } from "@formbricks/types/errors";
import type { TOrganizationRole } from "@formbricks/types/memberships";
import { ZOrganizationUpdateInput } from "@formbricks/types/organizations";
import { isInstanceAIConfigured } from "@/lib/ai/service";
import { deleteOrganization, getOrganization, updateOrganization } from "@/lib/organization/service";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import { AuthenticatedActionClientCtx } from "@/lib/utils/action-client/types/context";
import { getTranslate } from "@/lingodotdev/server";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";
import { getIsMultiOrgEnabled } from "@/modules/ee/license-check/lib/utils";
import { ZOrganizationAISettingsInput, ZUpdateOrganizationAISettingsAction } from "./schemas";

async function updateOrganizationAction<T extends z.ZodRawShape>({
  ctx,
  organizationId,
  schema,
  data,
  roles,
}: {
  ctx: AuthenticatedActionClientCtx;
  organizationId: string;
  schema: z.ZodObject<T>;
  data: z.infer<z.ZodObject<T>>;
  roles: TOrganizationRole[];
}) {
  await checkAuthorizationUpdated({
    userId: ctx.user.id,
    organizationId,
    access: [{ type: "organization", schema, data, roles }],
  });
  ctx.auditLoggingCtx.organizationId = organizationId;
  const oldObject = await getOrganization(organizationId);
  const result = await updateOrganization(organizationId, data);
  ctx.auditLoggingCtx.oldObject = oldObject;
  ctx.auditLoggingCtx.newObject = result;
  return result;
}

const ZUpdateOrganizationNameAction = z.object({
  organizationId: ZId,
  data: ZOrganizationUpdateInput.pick({ name: true }),
});

export const updateOrganizationNameAction = authenticatedActionClient
  .inputSchema(ZUpdateOrganizationNameAction)
  .action(
    withAuditLogging(
      "updated",
      "organization",
      async ({
        ctx,
        parsedInput,
      }: {
        ctx: AuthenticatedActionClientCtx;
        parsedInput: z.infer<typeof ZUpdateOrganizationNameAction>;
      }) =>
        updateOrganizationAction({
          ctx,
          organizationId: parsedInput.organizationId,
          schema: ZOrganizationUpdateInput.pick({ name: true }),
          data: parsedInput.data,
          roles: ["owner"],
        })
    )
  );

type TOrganizationAISettings = Pick<
  NonNullable<Awaited<ReturnType<typeof getOrganization>>>,
  "isAISmartToolsEnabled" | "isAIDataAnalysisEnabled"
>;

type TResolvedOrganizationAISettings = {
  smartToolsEnabled: boolean;
  dataAnalysisEnabled: boolean;
  isEnablingAnyAISetting: boolean;
};

const resolveOrganizationAISettings = ({
  data,
  organization,
}: {
  data: z.infer<typeof ZOrganizationAISettingsInput>;
  organization: TOrganizationAISettings;
}): TResolvedOrganizationAISettings => {
  const smartToolsEnabled = Object.hasOwn(data, "isAISmartToolsEnabled")
    ? (data.isAISmartToolsEnabled ?? organization.isAISmartToolsEnabled)
    : organization.isAISmartToolsEnabled;
  const dataAnalysisEnabled = Object.hasOwn(data, "isAIDataAnalysisEnabled")
    ? (data.isAIDataAnalysisEnabled ?? organization.isAIDataAnalysisEnabled)
    : organization.isAIDataAnalysisEnabled;

  return {
    smartToolsEnabled,
    dataAnalysisEnabled,
    isEnablingAnyAISetting:
      (smartToolsEnabled && !organization.isAISmartToolsEnabled) ||
      (dataAnalysisEnabled && !organization.isAIDataAnalysisEnabled),
  };
};

const assertOrganizationAISettingsUpdateAllowed = ({
  isInstanceAIConfigured,
  resolvedSettings,
  t,
}: {
  isInstanceAIConfigured: boolean;
  resolvedSettings: TResolvedOrganizationAISettings;
  t: Awaited<ReturnType<typeof getTranslate>>;
}) => {
  if (resolvedSettings.isEnablingAnyAISetting && !isInstanceAIConfigured) {
    throw new OperationNotAllowedError(t("environments.settings.general.ai_instance_not_configured"));
  }
};

export const updateOrganizationAISettingsAction = authenticatedActionClient
  .inputSchema(ZUpdateOrganizationAISettingsAction)
  .action(
    withAuditLogging(
      "updated",
      "organization",
      async ({
        ctx,
        parsedInput,
      }: {
        ctx: AuthenticatedActionClientCtx;
        parsedInput: z.infer<typeof ZUpdateOrganizationAISettingsAction>;
      }) => {
        const t = await getTranslate(ctx.user.locale);
        const organization = await getOrganization(parsedInput.organizationId);

        if (!organization) {
          throw new ResourceNotFoundError("Organization", parsedInput.organizationId);
        }

        const resolvedSettings = resolveOrganizationAISettings({
          data: parsedInput.data,
          organization,
        });

        assertOrganizationAISettingsUpdateAllowed({
          isInstanceAIConfigured: isInstanceAIConfigured(),
          resolvedSettings,
          t,
        });

        return updateOrganizationAction({
          ctx,
          organizationId: parsedInput.organizationId,
          schema: ZOrganizationAISettingsInput,
          data: parsedInput.data,
          roles: ["owner", "manager"],
        });
      }
    )
  );

const ZDeleteOrganizationAction = z.object({
  organizationId: ZId,
});

export const deleteOrganizationAction = authenticatedActionClient
  .inputSchema(ZDeleteOrganizationAction)
  .action(
    withAuditLogging("deleted", "organization", async ({ ctx, parsedInput }) => {
      const isMultiOrgEnabled = await getIsMultiOrgEnabled();
      if (!isMultiOrgEnabled) {
        const t = await getTranslate(ctx.user.locale);
        throw new OperationNotAllowedError(t("environments.settings.general.organization_deletion_disabled"));
      }

      await checkAuthorizationUpdated({
        userId: ctx.user.id,
        organizationId: parsedInput.organizationId,
        access: [
          {
            type: "organization",
            roles: ["owner"],
          },
        ],
      });
      ctx.auditLoggingCtx.organizationId = parsedInput.organizationId;
      const oldObject = await getOrganization(parsedInput.organizationId);
      ctx.auditLoggingCtx.oldObject = oldObject;
      return await deleteOrganization(parsedInput.organizationId);
    })
  );
