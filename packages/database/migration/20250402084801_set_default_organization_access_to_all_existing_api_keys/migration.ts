import type { MigrationScript } from "../../src/scripts/migration-runner";

export const setDefaultOrganizationAccessToAllExistingApiKeys: MigrationScript = {
  type: "data",
  id: "jd54tyjvat97yn9rgkgsneaq",
  name: "20250402084801_set_default_organization_access_to_all_existing_api_keys",
  run: async ({ tx }) => {
    try {
      await tx.$queryRaw`
      UPDATE "ApiKey"
      SET "organizationAccess" = '{"accessControl":{"read":false,"write":false}}'
      WHERE "organizationAccess" IS NULL OR "organizationAccess" = '{}'
    `;
    } catch (error) {
      console.error("Error adding organization access to API keys", error);
    }
  },
};
