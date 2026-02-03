/* eslint-disable no-constant-condition -- Required for the while loop */
/* eslint-disable @typescript-eslint/no-unnecessary-condition -- Required for a while loop here */
import { createId } from "@paralleldrive/cuid2";
import { logger } from "@formbricks/logger";
import type { MigrationScript } from "../../src/scripts/migration-runner";

export const addLanguageAttributeKey: MigrationScript = {
  type: "data",
  id: "l4n8g7u6a9g2e0k3e1y4a5d6",
  name: "20260121161018_add_language_attribute_key",
  run: async ({ tx }) => {
    const BATCH_SIZE = 10000;
    let skip = 0;
    let totalEnvironmentsProcessed = 0;
    let totalLanguageKeysAdded = 0;

    logger.info("Starting migration to add language attribute key to all environments");

    while (true) {
      // Fetch environments in batches
      const environments = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM "Environment" LIMIT ${BATCH_SIZE} OFFSET ${skip}
      `;

      if (environments.length === 0) {
        break;
      }

      logger.info(`Processing ${environments.length.toString()} environments (batch starting at ${skip})`);

      // Process each environment
      for (const env of environments) {
        try {
          // Insert language attribute key if it doesn't exist
          await tx.$executeRaw`
            INSERT INTO "ContactAttributeKey" (
              "id", "created_at", "updated_at", "key", "name", "description", "type", "isUnique", "environmentId"
            ) VALUES (
              ${createId()}, 
              NOW(), 
              NOW(), 
              'language', 
              'Language', 
              'The language preference of a contact', 
              'default', 
              false, 
              ${env.id}
            )
            ON CONFLICT ("key", "environmentId") DO NOTHING
          `;

          totalLanguageKeysAdded++;
        } catch (error) {
          logger.error(`Failed to add language attribute key for environment ${env.id}: ${error}`);
          throw error;
        }
      }

      skip += environments.length;
      totalEnvironmentsProcessed += environments.length;
    }

    // Verify migration
    const [{ total_language_keys: totalLanguageKeys }] = await tx.$queryRaw<
      [{ total_language_keys: number }]
    >`
      SELECT COUNT(*)::integer AS total_language_keys
      FROM "ContactAttributeKey"
      WHERE "key" = 'language'
    `;

    logger.info(`Migration completed successfully!`);
    logger.info(`Total environments processed: ${totalEnvironmentsProcessed.toString()}`);
    logger.info(`Total language attribute keys in database: ${totalLanguageKeys.toString()}`);
  },
};
