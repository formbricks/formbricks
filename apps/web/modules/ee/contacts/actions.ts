"use server";

import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { ZContactAttributes } from "@formbricks/types/contact-attribute";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import { AuthenticatedActionClientCtx } from "@/lib/utils/action-client/types/context";
import {
  getOrganizationIdFromContactId,
  getOrganizationIdFromEnvironmentId,
  getProjectIdFromContactId,
  getProjectIdFromEnvironmentId,
} from "@/lib/utils/helper";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";
import { createContactsFromCSV, deleteContact, getContact, getContacts } from "./lib/contacts";
import { updateContactAttributes } from "./lib/update-contact-attributes";
import {
  ZContactCSVAttributeMap,
  ZContactCSVDuplicateAction,
  ZContactCSVUploadResponse,
} from "./types/contact";

const ZGetContactsAction = z.object({
  environmentId: ZId,
  offset: z.number().int().nonnegative(),
  searchValue: z.string().optional(),
});

export const getContactsAction = authenticatedActionClient
  .schema(ZGetContactsAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromEnvironmentId(parsedInput.environmentId),
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
        {
          type: "projectTeam",
          minPermission: "read",
          projectId: await getProjectIdFromEnvironmentId(parsedInput.environmentId),
        },
      ],
    });

    return getContacts(parsedInput.environmentId, parsedInput.offset, parsedInput.searchValue);
  });

const ZContactDeleteAction = z.object({
  contactId: ZId,
});

export const deleteContactAction = authenticatedActionClient.schema(ZContactDeleteAction).action(
  withAuditLogging(
    "deleted",
    "contact",
    async ({ ctx, parsedInput }: { ctx: AuthenticatedActionClientCtx; parsedInput: Record<string, any> }) => {
      const organizationId = await getOrganizationIdFromContactId(parsedInput.contactId);
      const projectId = await getProjectIdFromContactId(parsedInput.contactId);

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
      ctx.auditLoggingCtx.contactId = parsedInput.contactId;

      const result = await deleteContact(parsedInput.contactId);

      ctx.auditLoggingCtx.oldObject = result;
      return result;
    }
  )
);

const ZCreateContactsFromCSV = z.object({
  csvData: ZContactCSVUploadResponse,
  environmentId: ZId,
  duplicateContactsAction: ZContactCSVDuplicateAction,
  attributeMap: ZContactCSVAttributeMap,
});

export const createContactsFromCSVAction = authenticatedActionClient.schema(ZCreateContactsFromCSV).action(
  withAuditLogging(
    "createdFromCSV",
    "contact",
    async ({ ctx, parsedInput }: { ctx: AuthenticatedActionClientCtx; parsedInput: Record<string, any> }) => {
      const organizationId = await getOrganizationIdFromEnvironmentId(parsedInput.environmentId);
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
            projectId: await getProjectIdFromEnvironmentId(parsedInput.environmentId),
            minPermission: "readWrite",
          },
        ],
      });

      ctx.auditLoggingCtx.organizationId = organizationId;
      const result = await createContactsFromCSV(
        parsedInput.csvData,
        parsedInput.environmentId,
        parsedInput.duplicateContactsAction,
        parsedInput.attributeMap
      );
      ctx.auditLoggingCtx.newObject = {
        contacts: result,
      };
      return result;
    }
  )
);

const ZUpdateContactAttributesAction = z.object({
  contactId: ZId,
  attributes: ZContactAttributes,
});

export const updateContactAttributesAction = authenticatedActionClient
  .schema(ZUpdateContactAttributesAction)
  .action(
    withAuditLogging(
      "updated",
      "contact",
      async ({
        ctx,
        parsedInput,
      }: {
        ctx: AuthenticatedActionClientCtx;
        parsedInput: Record<string, any>;
      }) => {
        const organizationId = await getOrganizationIdFromContactId(parsedInput.contactId);
        const projectId = await getProjectIdFromContactId(parsedInput.contactId);

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
        ctx.auditLoggingCtx.contactId = parsedInput.contactId;

        // Get contact to access environmentId for revalidation
        const contact = await getContact(parsedInput.contactId);
        if (!contact) {
          throw new Error("Contact not found");
        }

        const result = await updateContactAttributes(parsedInput.contactId, parsedInput.attributes);

        ctx.auditLoggingCtx.newObject = {
          contactId: parsedInput.contactId,
          attributes: result.updatedAttributes,
        };

        return result;
      }
    )
  );
