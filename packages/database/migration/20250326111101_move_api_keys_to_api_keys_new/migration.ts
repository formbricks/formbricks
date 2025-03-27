import type { MigrationScript } from "../../src/scripts/migration-runner";

export const moveApiKeysToApiKeysNew: MigrationScript = {
  type: "data",
  id: "mvwdryxrxaf8rhr97g2zlv3m",
  name: "20250326111101_move_api_keys_to_api_keys_new",
  run: async ({ tx }) => {
    // Step 1: Get all existing API keys with related data
    const apiKeys = await tx.$queryRaw`
      SELECT 
        ak.*,
        e.id as "environmentId",
        p.id as "projectId",
        o.id as "organizationId"
      FROM "ApiKey" ak
      JOIN "Environment" e ON ak."environmentId" = e.id
      JOIN "Project" p ON e."projectId" = p.id
      JOIN "Organization" o ON p."organizationId" = o.id
    `;
    // @ts-expect-error
    console.log(`Found ${apiKeys.length} API keys to migrate.`);

    // Step 2: Migrate each API key to the new format
    // @ts-expect-error
    for (const apiKey of apiKeys) {
      const organizationId = apiKey.organizationId;

      try {
        // Check if the API key already exists in the new table
        const existingKey = await tx.$queryRaw`
          SELECT id FROM "ApiKeyNew" WHERE id = ${apiKey.id}
        `;

        if (Array.isArray(existingKey) && existingKey.length > 0) {
          continue;
        }

        // Check if the API key environment relation already exists
        const existingEnv = await tx.$queryRaw`
          SELECT id FROM "ApiKeyEnvironment" 
          WHERE "apiKeyId" = ${apiKey.id} AND "environmentId" = ${apiKey.environmentId}
        `;

        if (Array.isArray(existingEnv) && existingEnv.length > 0) {
          continue;
        }

        // Step 3: Create new API key in the ApiKeyNew table and its environment relation
        await tx.$executeRaw`
          INSERT INTO "ApiKeyNew" (
            "id", 
            "createdAt", 
            "lastUsedAt", 
            "label",
            "hashedKey", 
            "organizationId"
          ) VALUES (
            ${apiKey.id},
            ${apiKey.createdAt},
            ${apiKey.lastUsedAt},
            ${apiKey.label},
            ${apiKey.hashedKey},
            ${organizationId}
          )
        `;

        // Create the API key environment relation using Prisma
        await tx.apiKeyEnvironment.create({
          data: {
            apiKeyId: apiKey.id,
            environmentId: apiKey.environmentId,
            permission: "manage",
          },
        });

        console.log(`Successfully migrated API key ${apiKey.id} to new model.`);
      } catch (error) {
        console.error(`Error migrating API key ${apiKey.id}:`, error);
      }
    }

    console.log("API key migration completed.");
  },
};
