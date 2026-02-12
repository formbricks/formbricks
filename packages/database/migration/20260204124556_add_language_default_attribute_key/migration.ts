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

    if (allEnvironments.length === 0) {
      logger.info("No environments found, skipping");
      return;
    }

    const envIds = allEnvironments.map((env) => env.id);
    const cuidIds = envIds.map(() => createId());

    await tx.$executeRawUnsafe(
      `
      INSERT INTO "ContactAttributeKey" (
        "id", "created_at", "updated_at", "key", "name", "description", "type", "isUnique", "environmentId"
      )
      SELECT id, NOW(), NOW(), 'language', 'Language', 'The language preference of a contact', 'default', false, env_id
      FROM unnest($1::text[], $2::text[]) AS t(id, env_id)
      ON CONFLICT ("key", "environmentId") DO UPDATE SET "type" = 'default', "updated_at" = NOW()
      `,
      cuidIds,
      envIds
    );

    logger.info(`Complete: Processed ${allEnvironments.length.toString()} environments`);
  },
};
