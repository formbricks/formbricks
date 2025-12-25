"use server";

import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import { AuthenticatedActionClientCtx } from "@/lib/utils/action-client/types/context";
import {
  getOrganizationIdFromEnvironmentId,
  getProjectIdFromEnvironmentId,
} from "@/lib/utils/helper";
import { isSafeIdentifier } from "@/lib/utils/safe-identifier";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";
import {
  createContactAttributeKey,
  updateContactAttributeKey,
  deleteContactAttributeKey,
  getContactAttributeKeyById,
} from "@/modules/ee/contacts/lib/contact-attribute-keys";

const ZCreateContactAttributeKeyAction = z.object({
  environmentId: ZId,
  key: z.string().refine(
    (val) => isSafeIdentifier(val),
    {
      message:
        "Key must be a safe identifier: only lowercase letters, numbers, and underscores, and must start with a letter",
    }
  ),
  name: z.string().optional(),
  description: z.string().optional(),
});

export const createContactAttributeKeyAction = authenticatedActionClient
  .schema(ZCreateContactAttributeKeyAction)
  .action(
    withAuditLogging(
      "created",
      "contactAttributeKey",
      async ({ ctx, parsedInput }: { ctx: AuthenticatedActionClientCtx; parsedInput: Record<string, any> }) => {
        const organizationId = await getOrganizationIdFromEnvironmentId(parsedInput.environmentId);
        const projectId = await getProjectIdFromEnvironmentId(parsedInput.environmentId);

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
              minPermission: "readWrite",
              projectId,
            },
          ],
        });

        ctx.auditLoggingCtx.organizationId = organizationId;

        const contactAttributeKey = await createContactAttributeKey({
          environmentId: parsedInput.environmentId,
          key: parsedInput.key,
          name: parsedInput.name,
          description: parsedInput.description,
        });

        ctx.auditLoggingCtx.newObject = contactAttributeKey;

        return contactAttributeKey;
      }
    )
  );

const ZUpdateContactAttributeKeyAction = z.object({
  id: ZId,
  name: z.string().optional(),
  description: z.string().optional(),
});

export const updateContactAttributeKeyAction = authenticatedActionClient
  .schema(ZUpdateContactAttributeKeyAction)
  .action(
    withAuditLogging(
      "updated",
      "contactAttributeKey",
      async ({ ctx, parsedInput }: { ctx: AuthenticatedActionClientCtx; parsedInput: Record<string, any> }) => {
        // Fetch existing key to check authorization and get environmentId
        const existingKey = await getContactAttributeKeyById(parsedInput.id);

        if (!existingKey) {
          throw new Error("Contact attribute key not found");
        }

        const organizationId = await getOrganizationIdFromEnvironmentId(existingKey.environmentId);
        const projectId = await getProjectIdFromEnvironmentId(existingKey.environmentId);

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
              minPermission: "readWrite",
              projectId,
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
      }
    )
  );

const ZDeleteContactAttributeKeyAction = z.object({
  id: ZId,
});

export const deleteContactAttributeKeyAction = authenticatedActionClient
  .schema(ZDeleteContactAttributeKeyAction)
  .action(
    withAuditLogging(
      "deleted",
      "contactAttributeKey",
      async ({ ctx, parsedInput }: { ctx: AuthenticatedActionClientCtx; parsedInput: Record<string, any> }) => {
        // Fetch existing key to check authorization and get environmentId
        const existingKey = await getContactAttributeKeyById(parsedInput.id);

        if (!existingKey) {
          throw new Error("Contact attribute key not found");
        }

        const organizationId = await getOrganizationIdFromEnvironmentId(existingKey.environmentId);
        const projectId = await getProjectIdFromEnvironmentId(existingKey.environmentId);

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
              minPermission: "readWrite",
              projectId,
            },
          ],
        });

        ctx.auditLoggingCtx.organizationId = organizationId;
        ctx.auditLoggingCtx.oldObject = existingKey;

        const deletedKey = await deleteContactAttributeKey(parsedInput.id);

        return deletedKey;
      }
    )
  );

