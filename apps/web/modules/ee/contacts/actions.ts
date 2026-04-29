"use server";

import { z } from "zod";
import { prisma } from "@formbricks/database";
import { ZId } from "@formbricks/types/common";
import { ZContactAttributesInput } from "@formbricks/types/contact-attribute";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { capturePostHogEvent } from "@/lib/posthog";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
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
  offset: z.int().nonnegative(),
  searchValue: z.string().optional(),
});

export const getContactsAction = authenticatedActionClient
  .inputSchema(ZGetContactsAction)
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

export const deleteContactAction = authenticatedActionClient.inputSchema(ZContactDeleteAction).action(
  withAuditLogging("deleted", "contact", async ({ ctx, parsedInput }) => {
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
  })
);

const ZCreateContactsFromCSV = z.object({
  csvData: ZContactCSVUploadResponse,
  environmentId: ZId,
  duplicateContactsAction: ZContactCSVDuplicateAction,
  attributeMap: ZContactCSVAttributeMap,
});

export const createContactsFromCSVAction = authenticatedActionClient
  .inputSchema(ZCreateContactsFromCSV)
  .action(
    withAuditLogging("createdFromCSV", "contact", async ({ ctx, parsedInput }) => {
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
      const projectId = await getProjectIdFromEnvironmentId(parsedInput.environmentId);
      const existingContactCount = await prisma.contact.count({
        where: { environmentId: parsedInput.environmentId },
      });
      const result = await createContactsFromCSV(
        parsedInput.csvData,
        parsedInput.environmentId,
        parsedInput.duplicateContactsAction,
        parsedInput.attributeMap
      );

      if ("contacts" in result) {
        ctx.auditLoggingCtx.newObject = {
          contacts: result.contacts,
        };

        capturePostHogEvent(
          ctx.user.id,
          "contact_created",
          {
            organization_id: organizationId,
            workspace_id: projectId,
            environment_id: parsedInput.environmentId,
            existing_contact_count: existingContactCount,
            creation_method: "import",
            import_count: result.contacts.length,
          },
          { organizationId, workspaceId: projectId }
        );
      }

      return result;
    })
  );

const ZUpdateContactAttributesAction = z.object({
  contactId: ZId,
  attributes: ZContactAttributesInput,
});

export type TUpdateContactAttributesAction = z.infer<typeof ZUpdateContactAttributesAction>;
export const updateContactAttributesAction = authenticatedActionClient
  .inputSchema(ZUpdateContactAttributesAction)
  .action(
    withAuditLogging("updated", "contact", async ({ ctx, parsedInput }) => {
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
        throw new ResourceNotFoundError("Contact", parsedInput.contactId);
      }

      const result = await updateContactAttributes(parsedInput.contactId, parsedInput.attributes);

      ctx.auditLoggingCtx.newObject = {
        contactId: parsedInput.contactId,
        attributes: result.updatedAttributes,
      };

      return result;
    })
  );
