"use server";

import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import { getOrganizationIdFromEnvironmentId, getProjectIdFromEnvironmentId } from "@/lib/utils/helper";

// Schema for importing contacts with enriched data
const ZImportContactsAction = z.object({
  environmentId: ZId,
  contacts: z.array(z.record(z.string(), z.string())),
});

/**
 * Action to import contacts from CSV (with optional enrichment)
 * This is a simplified version for the core module
 */
export const importContactsAction = authenticatedActionClient
  .schema(ZImportContactsAction)
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
          minPermission: "readWrite",
          projectId: await getProjectIdFromEnvironmentId(parsedInput.environmentId),
        },
      ],
    });

    // In the core version, we'll just validate the data and return success
    // The actual import logic would integrate with the database
    // For now, this serves as a placeholder that the UI can call

    const { contacts } = parsedInput;

    // Validate that all contacts have an email
    for (const contact of contacts) {
      if (!contact.email) {
        throw new Error("All contacts must have an email address");
      }
    }

    return {
      success: true,
      contactsProcessed: contacts.length,
      message: `Successfully validated ${contacts.length} contacts for import`,
    };
  });
