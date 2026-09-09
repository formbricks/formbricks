"use server";

import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { OperationNotAllowedError, ResourceNotFoundError } from "@formbricks/types/errors";
import { ZOrganizationUpdateInput } from "@formbricks/types/organizations";
import { isInstanceAIConfigured } from "@/lib/ai/service";
import { type TAuthorizationAction, assertCan } from "@/lib/authorization";
import { deleteOrganization, getOrganization, updateOrganization } from "@/lib/organization/service";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { AuthenticatedActionClientCtx } from "@/lib/utils/action-client/types/context";
import { getTranslate } from "@/lingodotdev/server";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";
import { getIsMultiOrgEnabled } from "@/modules/ee/license-check/lib/utils";
import {
  ZOrganizationAISettingsInput,
  ZUpdateOrganizationAISettingsAction,
  ZUpdateOrganizationDisplayTimeZoneAction,
} from "./schemas";

async function updateOrganizationAction<T extends z.ZodRawShape>({
  ctx,
  organizationId,
  data,
  action,
}: {
  ctx: AuthenticatedActionClientCtx;
  organizationId: string;
  data: z.infer<z.ZodObject<T>>;
  action: Extract<TAuthorizationAction, "organization.write" | "organization.manage">;
}) {
  await assertCan({ type: "user", id: ctx.user.id }, action, { type: "organization", id: organizationId });
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
          data: parsedInput.data,
          action: "organization.write",
        })
    )
  );

type TOrganizationAISettings = Pick<
  NonNullable<Awaited<ReturnType<typeof getOrganization>>>,
  "isAISmartToolsEnabled"
>;

type TResolvedOrganizationAISettings = {
  smartToolsEnabled: boolean;
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

  return {
    smartToolsEnabled,
    isEnablingAnyAISetting: smartToolsEnabled && !organization.isAISmartToolsEnabled,
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
    throw new OperationNotAllowedError(t("workspace.settings.general.ai_instance_not_configured"));
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
          data: parsedInput.data,
          action: "organization.manage",
        });
      }
    )
  );

export const updateOrganizationDisplayTimeZoneAction = authenticatedActionClient
  .inputSchema(ZUpdateOrganizationDisplayTimeZoneAction)
  .action(
    withAuditLogging(
      "updated",
      "organization",
      async ({
        ctx,
        parsedInput,
      }: {
        ctx: AuthenticatedActionClientCtx;
        parsedInput: z.infer<typeof ZUpdateOrganizationDisplayTimeZoneAction>;
      }) =>
        updateOrganizationAction({
          ctx,
          organizationId: parsedInput.organizationId,
          data: parsedInput.data,
          action: "organization.manage",
        })
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
        throw new OperationNotAllowedError(t("workspace.settings.general.organization_deletion_disabled"));
      }

      await assertCan({ type: "user", id: ctx.user.id }, "organization.write", {
        type: "organization",
        id: parsedInput.organizationId,
      });
      ctx.auditLoggingCtx.organizationId = parsedInput.organizationId;
      const oldObject = await getOrganization(parsedInput.organizationId);
      ctx.auditLoggingCtx.oldObject = oldObject;
      return await deleteOrganization(parsedInput.organizationId);
    })
  );
