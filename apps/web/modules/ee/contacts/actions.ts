"use server";

import { z } from "zod";
import { prisma } from "@formbricks/database";
import { ZId } from "@formbricks/types/common";
import { assertCan } from "@/lib/authorization";
import { capturePostHogEvent } from "@/lib/posthog";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { getOrganizationIdFromWorkspaceId } from "@/lib/utils/helper";
import { applyRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";
import { ensureContactsEnabled } from "@/modules/ee/contacts/lib/contacts-entitlement";
import { createContactsFromCSV } from "./lib/contacts";
import {
  ZContactCSVAttributeMap,
  ZContactCSVDuplicateAction,
  ZContactCSVUploadResponse,
} from "./types/contact";

const ZCreateContactsFromCSV = z.object({
  csvData: ZContactCSVUploadResponse,
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
      const existingContactCount = await prisma.contact.count({
        where: { workspaceId },
      });
      const result = await createContactsFromCSV(
        parsedInput.csvData,
        workspaceId,
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
