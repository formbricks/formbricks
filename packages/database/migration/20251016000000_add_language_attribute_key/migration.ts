/* eslint-disable no-constant-condition -- Required for the while loop */
/* eslint-disable @typescript-eslint/no-unnecessary-condition -- Required for a while loop here */
import { createId } from "@paralleldrive/cuid2";
import { logger } from "@formbricks/logger";
import type { MigrationScript } from "../../src/scripts/migration-runner";

export const addLanguageAttributeKey: MigrationScript = {
  type: "data",
  id: "add_language_attribute_key_v1",
  name: "20251016000000_add_language_attribute_key",
  run: async ({ tx }) => {
    const BATCH_SIZE = 1000;
    let skip = 0;
    let totalProcessed = 0;

    logger.info("Starting migration to add language attribute key to environments");

    while (true) {
      // Fetch environments in batches
      const environments = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM "Environment" 
        LIMIT ${BATCH_SIZE} OFFSET ${skip}
      `;

      if (environments.length === 0) {
        break;
      }

      logger.info(`Processing ${environments.length.toString()} environments`);

      // Process each environment
      for (const env of environments) {
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
      }

      totalProcessed += environments.length;
      skip += BATCH_SIZE;

      logger.info(`Processed ${totalProcessed.toString()} environments so far`);
    }

    logger.info(`Migration completed. Total environments processed: ${totalProcessed.toString()}`);
  },
};
