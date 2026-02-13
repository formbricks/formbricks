"use server";

import { z } from "zod";
import { prisma } from "@formbricks/database";
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
 * Creates contacts and their attributes in the database
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

    const { contacts, environmentId } = parsedInput;

    // Validate that all contacts have an email
    for (const contact of contacts) {
      if (!contact.email) {
        throw new Error("All contacts must have an email address");
      }
    }

    // Extract unique emails from CSV data
    const csvEmails = Array.from(new Set(contacts.map((r) => r.email).filter(Boolean)));

    // Find existing contacts by email to skip duplicates
    const existingContactsByEmail = await prisma.contact.findMany({
      where: {
        environmentId,
        attributes: {
          some: {
            attributeKey: { key: "email" },
            value: { in: csvEmails },
          },
        },
      },
      select: {
        id: true,
        attributes: {
          select: {
            attributeKey: { select: { key: true } },
            value: true,
          },
        },
      },
    });

    const existingEmails = new Set(
      existingContactsByEmail.flatMap((c) =>
        c.attributes.filter((a) => a.attributeKey.key === "email").map((a) => a.value)
      )
    );

    // Filter to only new contacts
    const newContacts = contacts.filter((c) => !existingEmails.has(c.email));

    if (newContacts.length === 0) {
      return {
        success: true,
        contactsProcessed: 0,
        message: "All contacts already exist",
      };
    }

    // Collect all unique CSV keys
    const csvKeys = new Set<string>();
    newContacts.forEach((record) => {
      Object.keys(record).forEach((key) => csvKeys.add(key));
    });

    // Fetch existing attribute keys
    const existingAttributeKeys = await prisma.contactAttributeKey.findMany({
      where: { environmentId },
      select: { key: true, id: true },
    });

    const attributeKeyMap = new Map<string, string>();
    const lowercaseToActualKeyMap = new Map<string, string>();

    existingAttributeKeys.forEach((attrKey) => {
      attributeKeyMap.set(attrKey.key, attrKey.id);
      lowercaseToActualKeyMap.set(attrKey.key.toLowerCase(), attrKey.key);
    });

    // Create missing attribute keys
    const missingKeys = Array.from(csvKeys).filter((key) => !lowercaseToActualKeyMap.has(key.toLowerCase()));

    if (missingKeys.length > 0) {
      const uniqueMissingKeys = new Map<string, string>();
      missingKeys.forEach((key) => {
        const lowerKey = key.toLowerCase();
        if (!uniqueMissingKeys.has(lowerKey)) {
          uniqueMissingKeys.set(lowerKey, key);
        }
      });

      await prisma.contactAttributeKey.createMany({
        data: Array.from(uniqueMissingKeys.values()).map((key) => ({
          key,
          name: key,
          environmentId,
        })),
        skipDuplicates: true,
      });

      // Re-fetch to get IDs for newly created keys
      const newAttributeKeys = await prisma.contactAttributeKey.findMany({
        where: {
          key: { in: Array.from(uniqueMissingKeys.values()) },
          environmentId,
        },
        select: { key: true, id: true },
      });

      newAttributeKeys.forEach((attrKey) => {
        attributeKeyMap.set(attrKey.key, attrKey.id);
        lowercaseToActualKeyMap.set(attrKey.key.toLowerCase(), attrKey.key);
      });
    }

    // Create contacts with their attributes
    let createdCount = 0;

    const contactPromises = newContacts.map(async (record) => {
      // Map CSV keys to actual DB keys (case-insensitive)
      const attributeCreateData: { attributeKeyId: string; value: string }[] = [];

      for (const [key, value] of Object.entries(record)) {
        if (!value) continue;
        const actualKey = lowercaseToActualKeyMap.get(key.toLowerCase());
        if (!actualKey) continue;
        const attributeKeyId = attributeKeyMap.get(actualKey);
        if (!attributeKeyId) continue;

        attributeCreateData.push({ attributeKeyId, value });
      }

      await prisma.contact.create({
        data: {
          environmentId,
          attributes: {
            create: attributeCreateData,
          },
        },
      });
    });

    const results = await Promise.allSettled(contactPromises);
    createdCount = results.filter((r) => r.status === "fulfilled").length;

    return {
      success: true,
      contactsProcessed: createdCount,
      message: `Successfully imported ${createdCount} contacts`,
    };
  });
