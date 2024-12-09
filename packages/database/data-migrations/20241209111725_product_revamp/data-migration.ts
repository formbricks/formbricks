import { Prisma } from "@prisma/client";
import type { DataMigrationScript } from "../../types/migration-runner";

type Plan = "free" | "startup" | "scale" | "enterprise";

const projectsLimitByPlan: Record<Plan, number | null> = {
  free: 3,
  startup: null,
  scale: null,
  enterprise: null,
};

export const productRevamp: DataMigrationScript = {
  id: "wq3b8pvrvm70nzmsg2647olq",
  name: "productRevamp",
  run: async ({ tx }) => {
    // Your migration script goes here

    const organizations = await tx.organization.findMany({
      where: {
        billing: {
          path: ["limits", "projects"],
          equals: Prisma.DbNull,
        },
      },
      select: {
        id: true,
        billing: true,
      },
    });

    const updateOrganizationPromises = organizations.map((org) =>
      tx.organization.update({
        where: {
          id: org.id,
        },
        data: {
          billing: {
            ...org.billing,
            limits: {
              ...org.billing.limits,
              projects: projectsLimitByPlan[org.billing.plan as Plan],
            },
          },
        },
      })
    );

    await Promise.all(updateOrganizationPromises);

    console.log(`Updated ${updateOrganizationPromises.length.toString()} organizations`);

    const updatedemptyConfigProjects = await tx.project.updateMany({
      where: {
        config: {
          equals: {},
        },
      },
      data: {
        config: {
          channel: null,
          industry: null,
        },
      },
    });

    console.log(`Updated ${updatedemptyConfigProjects.count.toString()} projects with empty config`);
  },
};
