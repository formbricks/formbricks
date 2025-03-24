import type { MigrationScript } from "../../src/scripts/migration-runner";

export const moveApiKeysToApiKeysNew: MigrationScript = {
  type: "data",
  id: "mvwdryxrxaf8rhr97g2zlv3m",
  name: "20250320111101_move_api_keys_to_api_keys_new",
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

      // Find the first organization member with owner role
      let createdBy;
      try {
        // @ts-expect-error
        const [membership] = await tx.$queryRaw`
          SELECT "userId"
          FROM "Membership"
          WHERE "organizationId" = ${organizationId}
          AND role = 'owner'
          LIMIT 1
        `;
        createdBy = membership?.userId || "system_migration";
      } catch (error) {
        console.error(`Error finding owner for organization ${organizationId}:`, error);
        createdBy = "system_migration";
      }

      console.log(
        `Migrating API key ${apiKey.id} from environment ${apiKey.environmentId} to organization ${organizationId}`
      );

      try {
        // Step 3: Create new API key in the ApiKeyNew table and its environment relation
        await tx.$executeRaw`
          INSERT INTO "ApiKeyNew" (
            "id", 
            "createdAt", 
            "lastUsedAt", 
            "label", 
            "hashedKey", 
            "createdBy", 
            "organizationId"
          ) VALUES (
            ${apiKey.id},
            ${apiKey.createdAt},
            ${apiKey.lastUsedAt},
            ${apiKey.label},
            ${apiKey.hashedKey},
            ${createdBy},
            ${organizationId}
          )
        `;

        // Create the API key environment relation
        await tx.$executeRaw`
          INSERT INTO "ApiKeyEnvironment" (
            "apiKeyId",
            "environmentId",
            "permission"
          ) VALUES (
            ${apiKey.id},
            ${apiKey.environmentId},
            'manage'
          )
        `;

        console.log(`Successfully migrated API key ${apiKey.id} to new model.`);
      } catch (error) {
        console.error(`Error migrating API key ${apiKey.id}:`, error);
      }
    }

    console.log("API key migration completed.");
  },
};
