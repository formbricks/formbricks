"use server";

import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { OperationNotAllowedError } from "@formbricks/types/errors";
import { ZOrganizationUpdateInput } from "@formbricks/types/organizations";
import { deleteOrganization, getOrganization, updateOrganization } from "@/lib/organization/service";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import { AuthenticatedActionClientCtx } from "@/lib/utils/action-client/types/context";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";
import { getIsMultiOrgEnabled } from "@/modules/ee/license-check/lib/utils";

const ZUpdateOrganizationAction = z.object({
  organizationId: ZId,
  data: ZOrganizationUpdateInput.partial().refine(
    (data) => Object.keys(data ?? {}).length > 0,
    "At least one field must be provided"
  ),
});

type UpdateOrganizationParsedInput = z.infer<typeof ZUpdateOrganizationAction>;

export const updateOrganizationAction = authenticatedActionClient.schema(ZUpdateOrganizationAction).action(
  withAuditLogging(
    "updated",
    "organization",
    async ({
      ctx,
      parsedInput,
    }: {
      ctx: AuthenticatedActionClientCtx;
      parsedInput: UpdateOrganizationParsedInput;
    }) => {
      await checkAuthorizationUpdated({
        userId: ctx.user.id,
        organizationId: parsedInput.organizationId,
        access: [
          {
            type: "organization",
            schema: ZOrganizationUpdateInput.partial(),
            data: parsedInput.data,
            roles: ["owner", "manager"],
          },
        ],
      });
      ctx.auditLoggingCtx.organizationId = parsedInput.organizationId;
      const oldObject = await getOrganization(parsedInput.organizationId);
      const result = await updateOrganization(parsedInput.organizationId, parsedInput.data);
      ctx.auditLoggingCtx.oldObject = oldObject;
      ctx.auditLoggingCtx.newObject = result;
      return result;
    }
  )
);

const ZDeleteOrganizationAction = z.object({
  organizationId: ZId,
});

export const deleteOrganizationAction = authenticatedActionClient.schema(ZDeleteOrganizationAction).action(
  withAuditLogging(
    "deleted",
    "organization",
    async ({ ctx, parsedInput }: { ctx: AuthenticatedActionClientCtx; parsedInput: Record<string, any> }) => {
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
    }
  )
);
