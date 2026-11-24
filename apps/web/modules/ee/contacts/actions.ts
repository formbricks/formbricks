"use server";

import { z } from "zod";
import { prisma } from "@formbricks/database";
import { ZId } from "@formbricks/types/common";
import { ZContactAttributesInput } from "@formbricks/types/contact-attribute";
import { OperationNotAllowedError } from "@formbricks/types/errors";
import { assertCan } from "@/lib/authorization";
import { capturePostHogEvent } from "@/lib/posthog";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { getOrganizationIdFromWorkspaceId } from "@/lib/utils/helper";
import { applyRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";
import { CONTACT_IN_SHARED_DIRECTORY_ERROR_CODE } from "@/modules/ee/contacts/lib/contact-delete-errors";
import { requireWorkspaceContactDirectory } from "@/modules/ee/contacts/lib/contact-directory";
import { ensureContactsEnabled } from "@/modules/ee/contacts/lib/contacts-entitlement";
import { ContactInSharedDirectoryError, deleteContactInWorkspace } from "./lib/contacts";
import { createContactsFromCSV } from "./lib/contacts-csv-upload";
import { updateContactAttributes } from "./lib/update-contact-attributes";
import { ZContactCSVAttributeMap, ZContactCSVDuplicateAction, ZContactCSVRecords } from "./types/contact";

// The workspace comes from the page, never from the contact: a contact's own `workspaceId` only records
// where it was created. The lib calls then require the contact to be in that workspace's directory.
const ZContactDeleteAction = z.object({
  contactId: ZId,
  workspaceId: ZId,
});

export const deleteContactAction = authenticatedActionClient.inputSchema(ZContactDeleteAction).action(
  withAuditLogging("deleted", "contact", async ({ ctx, parsedInput }) => {
    const { workspaceId } = parsedInput;
    const organizationId = await getOrganizationIdFromWorkspaceId(workspaceId);

    await assertCan({ type: "user", id: ctx.user.id }, "workspace.write", {
      type: "workspace",
      id: workspaceId,
    });
    await applyRateLimit(rateLimitConfigs.actions.stateMutation, workspaceId);

    await ensureContactsEnabled(organizationId);

    ctx.auditLoggingCtx.organizationId = organizationId;
    ctx.auditLoggingCtx.contactId = parsedInput.contactId;

    try {
      const result = await deleteContactInWorkspace(parsedInput.contactId, workspaceId);
      ctx.auditLoggingCtx.oldObject = result;
      return result;
    } catch (error) {
      // The page translates the code; the APIs show the error's own message.
      if (error instanceof ContactInSharedDirectoryError) {
        throw new OperationNotAllowedError(CONTACT_IN_SHARED_DIRECTORY_ERROR_CODE);
      }
      throw error;
    }
  })
);

const ZCreateContactsFromCSV = z.object({
  // The identity column is checked by the service once the workspace's directory is known.
  csvData: ZContactCSVRecords,
  workspaceId: ZId,
  duplicateContactsAction: ZContactCSVDuplicateAction,
  attributeMap: ZContactCSVAttributeMap,
});

export const createContactsFromCSVAction = authenticatedActionClient
  .inputSchema(ZCreateContactsFromCSV)
  .action(
    withAuditLogging("createdFromCSV", "contact", async ({ ctx, parsedInput }) => {
      const workspaceId = parsedInput.workspaceId;
      const organizationId = await getOrganizationIdFromWorkspaceId(workspaceId);
      await assertCan({ type: "user", id: ctx.user.id }, "workspace.write", {
        type: "workspace",
        id: workspaceId,
      });
      await applyRateLimit(rateLimitConfigs.actions.stateMutation, workspaceId);

      await ensureContactsEnabled(organizationId);

      ctx.auditLoggingCtx.organizationId = organizationId;
      // Before any write: a workspace with no directory gets the decision 13 message and nothing is created.
      const directory = await requireWorkspaceContactDirectory(workspaceId);
      const existingContactCount = await prisma.contact.count({
        where: { directoryId: directory.id },
      });
      const result = await createContactsFromCSV(
        parsedInput.csvData,
        workspaceId,
        directory,
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
            workspace_id: workspaceId,
            existing_contact_count: existingContactCount,
            creation_method: "import",
            import_count: result.contacts.length,
          },
          { organizationId, workspaceId }
        );
      }

      return result;
    })
  );

const ZUpdateContactAttributesAction = z.object({
  contactId: ZId,
  workspaceId: ZId,
  attributes: ZContactAttributesInput,
});

export type TUpdateContactAttributesAction = z.infer<typeof ZUpdateContactAttributesAction>;
export const updateContactAttributesAction = authenticatedActionClient
  .inputSchema(ZUpdateContactAttributesAction)
  .action(
    withAuditLogging("updated", "contact", async ({ ctx, parsedInput }) => {
      const { workspaceId } = parsedInput;
      const organizationId = await getOrganizationIdFromWorkspaceId(workspaceId);

      await assertCan({ type: "user", id: ctx.user.id }, "workspace.write", {
        type: "workspace",
        id: workspaceId,
      });
      await applyRateLimit(rateLimitConfigs.actions.stateMutation, workspaceId);

      await ensureContactsEnabled(organizationId);

      ctx.auditLoggingCtx.organizationId = organizationId;
      ctx.auditLoggingCtx.contactId = parsedInput.contactId;

      const result = await updateContactAttributes(
        parsedInput.contactId,
        workspaceId,
        parsedInput.attributes
      );

      ctx.auditLoggingCtx.newObject = {
        contactId: parsedInput.contactId,
        attributes: result.updatedAttributes,
      };

      return result;
    })
  );
