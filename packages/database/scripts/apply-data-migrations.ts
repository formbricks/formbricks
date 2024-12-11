/* eslint-disable no-constant-condition -- Required for the while loop */
import { type DataMigrationScript } from "../types/migration-runner";

/* eslint-disable @typescript-eslint/no-unnecessary-condition -- Required for a while loop here */

export const xmUserIdentification: DataMigrationScript = {
  type: "data",
  id: "n2u5d3wmcw1t2h8a4vgfu2y9",
  name: "xmUserIdentification",
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
      console.log("Migration already completed. No contacts with userId found.");
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

      console.log("Processing attributeKeys for", environments.length, "environments");

      // Process each environment
      for (const env of environments) {
        // Upsert attribute keys for each environment
        await tx.$executeRaw`
          INSERT INTO "ContactAttributeKey" (
            "key", "name", "description", "type", "isUnique", "environmentId"
          ) VALUES 
            ('email', 'Email', 'The email of a contact', 'default', true, ${env.id}),
            ('firstName', 'First Name', 'Your contact''s first name', 'default', false, ${env.id}),
            ('lastName', 'Last Name', 'Your contact''s last name', 'default', false, ${env.id}),
            ('userId', 'User ID', 'The user ID of a contact', 'default', true, ${env.id})
          ON CONFLICT ("key", "environmentId") DO UPDATE 
          SET 
            "type" = EXCLUDED."type",
            "isUnique" = EXCLUDED."isUnique"
        `;
      }

      skip += environments.length;
    }

    const CONTACTS_BATCH_SIZE = 20000;
    let processedContacts = 0;

    // Delete existing userId attributes
    const [{ deleted_count: deletedCount }] = await tx.$queryRaw<[{ deleted_count: number }]>`
      DELETE FROM "ContactAttribute" 
      WHERE "attributeKeyId" IN (
        SELECT id FROM "ContactAttributeKey" 
        WHERE "key" = 'userId'
      ) RETURNING COUNT(*)
    `;

    console.log("Deleted userId attributes for", deletedCount, "contacts");

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
        AND "environmentId" IN (${contacts.map((c) => c.environmentId).join(",")})
      `;

      // Create a map for quick lookup
      const attributeMap = new Map(userIdAttributeKeys.map((ak) => [ak.environmentId, ak.id]));

      // Bulk insert contact attributes
      await tx.$executeRaw`
        INSERT INTO "ContactAttribute" ("contactId", "value", "attributeKeyId")
        VALUES ${contacts
          .map((contact) => {
            const userIdAttributeKey = attributeMap.get(contact.environmentId);
            if (!userIdAttributeKey) {
              throw new Error(`Attribute key for userId not found for environment ${contact.environmentId}`);
            }
            return `('${contact.id}', '${contact.userId}', '${userIdAttributeKey}')`;
          })
          .join(",")}
      `;

      // Clear userId from contacts
      await tx.$executeRaw`
        UPDATE "Contact" 
        SET "userId" = NULL 
        WHERE id IN (${contacts.map((c) => `'${c.id}'`).join(",")})
      `;

      processedContacts += contacts.length;

      if (processedContacts > 0) {
        console.log(`Processed ${processedContacts.toString()} contacts`);
      }
    }

    // Verify migration
    const [{ total_contacts_after_migration: totalContactsAfterMigration }] = await tx.$queryRaw<
      [{ total_contacts_after_migration: number }]
    >`
      SELECT COUNT(*) AS total_contacts_after_migration FROM "Contact"
    `;

    const [{ total_user_id_attributes: totalUserIdAttributes }] = await tx.$queryRaw<
      [{ total_user_id_attributes: number }]
    >`
      SELECT COUNT(*) AS total_user_id_attributes 
      FROM "ContactAttribute" 
      WHERE "attributeKeyId" IN (
        SELECT id FROM "ContactAttributeKey" 
        WHERE "key" = 'userId'
      )
    `;

    console.log("Total contacts after migration:", totalContactsAfterMigration);
    console.log("Total attributes with userId now:", totalUserIdAttributes);

    if (totalContactsAfterMigration !== totalUserIdAttributes) {
      throw new Error(
        "Data migration failed. Total contacts after migration does not match total attributes with userId"
      );
    }
  },
};
