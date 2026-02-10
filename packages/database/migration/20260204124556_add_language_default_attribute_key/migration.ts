import { createId } from "@paralleldrive/cuid2";
import { logger } from "@formbricks/logger";
import type { MigrationScript } from "../../src/scripts/migration-runner";

export const addLanguageDefaultAttributeKey: MigrationScript = {
  type: "data",
  id: "k7lang2default0attr9key5",
  name: "20260204124556_add_language_default_attribute_key",
  run: async ({ tx }) => {
    logger.info("Adding language attribute key to all environments...");

    const allEnvironments = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM "Environment"
    `;

    for (const env of allEnvironments) {
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
        ON CONFLICT ("key", "environmentId") DO UPDATE SET "type" = 'default'
      `;
    }

    logger.info(`Complete: Processed ${allEnvironments.length.toString()} environments`);
  },
};
