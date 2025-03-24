/* eslint-disable no-constant-condition -- Required for the while loop */
/* eslint-disable @typescript-eslint/no-unnecessary-condition -- Required for a while loop here */
import { createId } from "@paralleldrive/cuid2";
import { Prisma } from "@prisma/client";
import { logger } from "@formbricks/logger";
import type { MigrationScript } from "../../src/scripts/migration-runner";

export const xmUserIdentification: MigrationScript = {
  type: "data",
  id: "n2u5d3wmcw1t2h8a4vgfu2y9",
  name: "20241209104738_xm_user_identification",
  run: async ({ tx }) => {
    // Check total contacts
    const [{ total_contacts: totalContacts }] = await tx.$queryRaw<[{ total_contacts: number }]>`
    SELECT COUNT(*) AS total_contacts FROM "Contact"
  `;

    // Check contacts with userId
    const [{ contacts_with_user_id: contactsWithUserId }] = await tx.$queryRaw<
      [{ contacts_with_user_id: number }]
    >`
    SELECT COUNT(*) AS contacts_with_user_id FROM "Contact" WHERE "userId" IS NOT NULL
  `;

    // If no contacts have a userId, migration is already complete
    if (totalContacts > 0 && contactsWithUserId === 0) {
      logger.info("Migration already completed. No contacts with userId found.");
      return;
    }

    const BATCH_SIZE = 10000;
    let skip = 0;

    while (true) {
      // Fetch environments in batches
      const environments = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM "Environment" LIMIT ${BATCH_SIZE} OFFSET ${skip}
    `;

      if (environments.length === 0) {
        break;
      }

      logger.info(`Processing attributeKeys for ${environments.length.toString()} environments`);

      // Process each environment
      for (const env of environments) {
        // Upsert attribute keys for each environment
        await tx.$executeRaw`
        INSERT INTO "ContactAttributeKey" (
          "id", "created_at", "updated_at", "key", "name", "description", "type", "isUnique", "environmentId"
        ) VALUES
          (${createId()}, NOW(), NOW(), 'email', 'Email', 'The email of a contact', 'default', true, ${env.id}),
          (${createId()}, NOW(), NOW(),'firstName', 'First Name', 'Your contact''s first name', 'default', false, ${env.id}),
          (${createId()}, NOW(), NOW(), 'lastName', 'Last Name', 'Your contact''s last name', 'default', false, ${env.id}),
          (${createId()}, NOW(), NOW(), 'userId', 'User ID', 'The user ID of a contact', 'default', true, ${env.id})
        ON CONFLICT ("key", "environmentId") DO UPDATE
        SET
          "type" = EXCLUDED."type",
          "isUnique" = EXCLUDED."isUnique",
          "updated_at" = NOW()
      `;
      }

      skip += environments.length;
    }

    const CONTACTS_BATCH_SIZE = 20000;
    let processedContacts = 0;

    // Delete existing userId attributes
    const [{ deleted_count: deletedCount }] = await tx.$queryRaw<[{ deleted_count: number }]>`
    WITH deleted AS (
      DELETE FROM "ContactAttribute" 
      WHERE "attributeKeyId" IN (
        SELECT id FROM "ContactAttributeKey" 
        WHERE "key" = 'userId'
      )
      RETURNING 1
    )
    SELECT COUNT(*)::integer AS deleted_count FROM deleted
  `;

    logger.info(`Deleted userId attributes for ${deletedCount.toString()} contacts`);

    while (true) {
      // Fetch contacts with userId in batches
      const contacts = await tx.$queryRaw<
        {
          id: string;
          userId: string;
          environmentId: string;
        }[]
      >`
      SELECT id, "userId", "environmentId" 
      FROM "Contact" 
      WHERE "userId" IS NOT NULL 
      LIMIT ${CONTACTS_BATCH_SIZE}
    `;

      if (contacts.length === 0) {
        break;
      }

      // Get userId attribute keys for environments
      const userIdAttributeKeys = await tx.$queryRaw<
        {
          id: string;
          environmentId: string;
        }[]
      >`
      SELECT id, "environmentId" 
      FROM "ContactAttributeKey" 
      WHERE "key" = 'userId' 
      AND "environmentId" IN (${Prisma.join(contacts.map((c) => c.environmentId))})
    `;

      // Create a map for quick lookup
      const attributeMap = new Map(userIdAttributeKeys.map((ak) => [ak.environmentId, ak.id]));

      const attributeData = contacts.map((contact) => {
        const userIdAttributeKey = attributeMap.get(contact.environmentId);
        if (!userIdAttributeKey) {
          throw new Error(`Attribute key for userId not found for environment ${contact.environmentId}`);
        }
        return {
          id: createId(),
          created_at: new Date(),
          updated_at: new Date(),
          contactId: contact.id,
          value: contact.userId,
          attributeKeyId: userIdAttributeKey,
        };
      });

      await tx.$executeRaw`
      INSERT INTO "ContactAttribute" (
        "id",
        "created_at",
        "updated_at",
        "contactId", 
        "value",
        "attributeKeyId"
      )
      SELECT 
        unnest(${Prisma.sql`ARRAY[${attributeData.map((d) => d.id)}]`}),
        unnest(${Prisma.sql`ARRAY[${attributeData.map((d) => d.created_at)}]`}),
        unnest(${Prisma.sql`ARRAY[${attributeData.map((d) => d.updated_at)}]`}),
        unnest(${Prisma.sql`ARRAY[${attributeData.map((d) => d.contactId)}]`}),
        unnest(${Prisma.sql`ARRAY[${attributeData.map((d) => d.value)}]`}),
        unnest(${Prisma.sql`ARRAY[${attributeData.map((d) => d.attributeKeyId)}]`})
      ON CONFLICT ("contactId", "attributeKeyId") DO UPDATE 
      SET 
        "value" = EXCLUDED."value",
        "updated_at" = EXCLUDED."updated_at"
    `;

      // Clear userId from contacts
      await tx.$queryRaw(Prisma.sql`
      UPDATE "Contact" 
      SET "userId" = NULL
      WHERE id IN (${Prisma.join(contacts.map((c) => c.id))})
    `);

      processedContacts += contacts.length;

      if (processedContacts > 0) {
        logger.info(`Processed ${processedContacts.toString()} contacts`);
      }
    }

    // Verify migration
    const [{ total_contacts_after_migration: totalContactsAfterMigration }] = await tx.$queryRaw<
      [{ total_contacts_after_migration: number }]
    >`
      SELECT COUNT(*)::integer AS total_contacts_after_migration FROM "Contact"
    `;

    const [{ total_user_id_attributes: totalUserIdAttributes }] = await tx.$queryRaw<
      [{ total_user_id_attributes: number }]
    >`
    SELECT COUNT(*)::integer AS total_user_id_attributes 
    FROM "ContactAttribute" 
    WHERE "attributeKeyId" IN (
      SELECT id FROM "ContactAttributeKey" 
      WHERE "key" = 'userId'
    )
  `;

    logger.info(`Total contacts after migration: ${totalContactsAfterMigration.toString()}`);
    logger.info(`Total attributes with userId now: ${totalUserIdAttributes.toString()}`);

    if (totalContactsAfterMigration !== totalUserIdAttributes) {
      logger.info(
        `Difference between total contacts and total attributes with userId: ${(totalContactsAfterMigration - totalUserIdAttributes).toString()}`
      );
    }
  },
};
