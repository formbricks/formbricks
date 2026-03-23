"use server";

import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { OperationNotAllowedError } from "@formbricks/types/errors";
import type { TOrganizationRole } from "@formbricks/types/memberships";
import { ZOrganizationUpdateInput } from "@formbricks/types/organizations";
import { deleteOrganization, getOrganization, updateOrganization } from "@/lib/organization/service";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import { AuthenticatedActionClientCtx } from "@/lib/utils/action-client/types/context";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";
import { getIsMultiOrgEnabled } from "@/modules/ee/license-check/lib/utils";

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

const ZUpdateOrganizationAISettingsAction = z.object({
  organizationId: ZId,
  data: ZOrganizationUpdateInput.pick({ isAISmartToolsEnabled: true, isAIDataAnalysisEnabled: true }),
});

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
      }) =>
        updateOrganizationAction({
          ctx,
          organizationId: parsedInput.organizationId,
          schema: ZOrganizationUpdateInput.pick({
            isAISmartToolsEnabled: true,
            isAIDataAnalysisEnabled: true,
          }),
          data: parsedInput.data,
          roles: ["owner", "manager"],
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
      if (!isMultiOrgEnabled) throw new OperationNotAllowedError("Organization deletion disabled");

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
