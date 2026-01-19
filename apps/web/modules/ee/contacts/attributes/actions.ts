"use server";

import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { ZContactAttributeDataType } from "@formbricks/types/contact-attribute-key";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import { AuthenticatedActionClientCtx } from "@/lib/utils/action-client/types/context";
import { getOrganizationIdFromEnvironmentId, getProjectIdFromEnvironmentId } from "@/lib/utils/helper";
import { isSafeIdentifier } from "@/lib/utils/safe-identifier";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";
import {
  createContactAttributeKey,
  deleteContactAttributeKey,
  getContactAttributeKeyById,
  updateContactAttributeKey,
} from "@/modules/ee/contacts/lib/contact-attribute-keys";

const ZCreateContactAttributeKeyAction = z.object({
  environmentId: ZId,
  key: z.string().refine((val) => isSafeIdentifier(val), {
    message:
      "Key must be a safe identifier: only lowercase letters, numbers, and underscores, and must start with a letter",
  }),
  name: z.string().optional(),
  description: z.string().optional(),
  dataType: ZContactAttributeDataType.optional(),
});

type TCreateContactAttributeKeyActionInput = z.infer<typeof ZCreateContactAttributeKeyAction>;
export const createContactAttributeKeyAction = authenticatedActionClient
  .schema(ZCreateContactAttributeKeyAction)
  .action(
    withAuditLogging(
      "created",
      "contactAttributeKey",
      async ({
        ctx,
        parsedInput,
      }: {
        ctx: AuthenticatedActionClientCtx;
        parsedInput: TCreateContactAttributeKeyActionInput;
      }) => {
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
          dataType: parsedInput.dataType,
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
type TUpdateContactAttributeKeyActionInput = z.infer<typeof ZUpdateContactAttributeKeyAction>;
export const updateContactAttributeKeyAction = authenticatedActionClient
  .schema(ZUpdateContactAttributeKeyAction)
  .action(
    withAuditLogging(
      "updated",
      "contactAttributeKey",
      async ({
        ctx,
        parsedInput,
      }: {
        ctx: AuthenticatedActionClientCtx;
        parsedInput: TUpdateContactAttributeKeyActionInput;
      }) => {
        // Fetch existing key to check authorization and get environmentId
        const existingKey = await getContactAttributeKeyById(parsedInput.id);

        if (!existingKey) {
          throw new ResourceNotFoundError("contactAttributeKey", parsedInput.id);
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
type TDeleteContactAttributeKeyActionInput = z.infer<typeof ZDeleteContactAttributeKeyAction>;

export const deleteContactAttributeKeyAction = authenticatedActionClient
  .schema(ZDeleteContactAttributeKeyAction)
  .action(
    withAuditLogging(
      "deleted",
      "contactAttributeKey",
      async ({
        ctx,
        parsedInput,
      }: {
        ctx: AuthenticatedActionClientCtx;
        parsedInput: TDeleteContactAttributeKeyActionInput;
      }) => {
        // Fetch existing key to check authorization and get environmentId
        const existingKey = await getContactAttributeKeyById(parsedInput.id);

        if (!existingKey) {
          throw new ResourceNotFoundError("contactAttributeKey", parsedInput.id);
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
