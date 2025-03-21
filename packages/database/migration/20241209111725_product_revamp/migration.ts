import { logger } from "@formbricks/logger";
import type { MigrationScript } from "../../src/scripts/migration-runner";

type Plan = "free" | "startup" | "scale" | "enterprise";

const projectsLimitByPlan: Record<Plan, number | null> = {
  free: 3,
  startup: null,
  scale: null,
  enterprise: null,
};

export const productRevamp: MigrationScript = {
  type: "data",
  id: "wq3b8pvrvm70nzmsg2647olq",
  name: "20241209111725_product_revamp",
  run: async ({ tx }) => {
    // Your migration script goes here

    const organizations = await tx.$queryRaw<
      {
        id: string;
        billing: {
          plan: Plan;
          limits: {
            monthly: {
              responses: number;
              miu: number;
            };
            projects: number | null;
          };
        };
      }[]
    >`SELECT id, billing FROM "Organization" WHERE (billing->'limits'->>'projects') IS NULL`;

    const updateOrganizationPromises = organizations.map((org) => {
      const updatedBilling = {
        ...org.billing,
        limits: {
          ...org.billing.limits,
          projects: projectsLimitByPlan[org.billing.plan],
        },
      };

      return tx.$executeRaw`UPDATE "Organization" SET billing = ${updatedBilling}::jsonb WHERE id = ${org.id}`;
    });

    await Promise.all(updateOrganizationPromises);

    logger.info(`Updated ${updateOrganizationPromises.length.toString()} organizations`);

    const updatedEmptyConfigProjects: number | undefined = await tx.$executeRaw`
          UPDATE "Project"
          SET config = jsonb_set(
              jsonb_set(config, '{channel}', 'null'::jsonb, true),
              '{industry}', 'null'::jsonb, true
          )
          WHERE config = '{}';
        `;

    logger.info(
      `Updated ${updatedEmptyConfigProjects ? updatedEmptyConfigProjects.toString() : "0"} projects with empty config`
    );
  },
};
