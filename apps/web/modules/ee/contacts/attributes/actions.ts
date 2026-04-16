"use server";

import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { ZContactAttributeDataType } from "@formbricks/types/contact-attribute-key";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import { getOrganizationIdFromWorkspaceId } from "@/lib/utils/helper";
import { isSafeIdentifier } from "@/lib/utils/safe-identifier";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";
import {
  createContactAttributeKey,
  deleteContactAttributeKey,
  getContactAttributeKeyById,
  updateContactAttributeKey,
} from "@/modules/ee/contacts/lib/contact-attribute-keys";

const ZCreateContactAttributeKeyAction = z.object({
  workspaceId: ZId,
  key: z.string().refine((val) => isSafeIdentifier(val), {
    error:
      "Key must be a safe identifier: only lowercase letters, numbers, and underscores, and must start with a letter",
  }),
  name: z.string().optional(),
  description: z.string().optional(),
  dataType: ZContactAttributeDataType.optional(),
});

export const createContactAttributeKeyAction = authenticatedActionClient
  .inputSchema(ZCreateContactAttributeKeyAction)
  .action(
    withAuditLogging("created", "contactAttributeKey", async ({ ctx, parsedInput }) => {
      const workspaceId = parsedInput.workspaceId;
      const organizationId = await getOrganizationIdFromWorkspaceId(workspaceId);

      await checkAuthorizationUpdated({
        userId: ctx.user.id,
        organizationId,
        access: [
          {
            type: "organization",
            roles: ["owner", "manager"],
          },
          {
            type: "workspaceTeam",
            minPermission: "readWrite",
            workspaceId,
          },
        ],
      });

      ctx.auditLoggingCtx.organizationId = organizationId;

      const contactAttributeKey = await createContactAttributeKey({
        workspaceId,
        key: parsedInput.key,
        name: parsedInput.name,
        description: parsedInput.description,
        dataType: parsedInput.dataType,
      });

      ctx.auditLoggingCtx.newObject = contactAttributeKey;

      return contactAttributeKey;
    })
  );

const ZUpdateContactAttributeKeyAction = z.object({
  id: ZId,
  name: z.string().optional(),
  description: z.string().optional(),
});
export const updateContactAttributeKeyAction = authenticatedActionClient
  .inputSchema(ZUpdateContactAttributeKeyAction)
  .action(
    withAuditLogging("updated", "contactAttributeKey", async ({ ctx, parsedInput }) => {
      // Fetch existing key to check authorization
      const existingKey = await getContactAttributeKeyById(parsedInput.id);

      if (!existingKey) {
        throw new ResourceNotFoundError("contactAttributeKey", parsedInput.id);
      }

      const workspaceId = existingKey.workspaceId;
      const organizationId = await getOrganizationIdFromWorkspaceId(workspaceId);

      await checkAuthorizationUpdated({
        userId: ctx.user.id,
        organizationId,
        access: [
          {
            type: "organization",
            roles: ["owner", "manager"],
          },
          {
            type: "workspaceTeam",
            minPermission: "readWrite",
            workspaceId,
          },
        ],
      });

      ctx.auditLoggingCtx.organizationId = organizationId;
      ctx.auditLoggingCtx.oldObject = existingKey;

      const updatedKey = await updateContactAttributeKey(parsedInput.id, {
        name: parsedInput.name,
        description: parsedInput.description,
      });

      ctx.auditLoggingCtx.newObject = updatedKey;

      return updatedKey;
    })
  );

const ZDeleteContactAttributeKeyAction = z.object({
  id: ZId,
});
export const deleteContactAttributeKeyAction = authenticatedActionClient
  .inputSchema(ZDeleteContactAttributeKeyAction)
  .action(
    withAuditLogging("deleted", "contactAttributeKey", async ({ ctx, parsedInput }) => {
      // Fetch existing key to check authorization
      const existingKey = await getContactAttributeKeyById(parsedInput.id);

      if (!existingKey) {
        throw new ResourceNotFoundError("contactAttributeKey", parsedInput.id);
      }

      const workspaceId = existingKey.workspaceId;
      const organizationId = await getOrganizationIdFromWorkspaceId(workspaceId);

      await checkAuthorizationUpdated({
        userId: ctx.user.id,
        organizationId,
        access: [
          {
            type: "organization",
            roles: ["owner", "manager"],
          },
          {
            type: "workspaceTeam",
            minPermission: "readWrite",
            workspaceId,
          },
        ],
      });

      ctx.auditLoggingCtx.organizationId = organizationId;
      ctx.auditLoggingCtx.oldObject = existingKey;

      const deletedKey = await deleteContactAttributeKey(parsedInput.id);

      return deletedKey;
    })
  );
