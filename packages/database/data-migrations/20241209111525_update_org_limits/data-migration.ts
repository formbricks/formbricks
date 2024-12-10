import type { DataMigrationScript } from "../../types/migration-runner";

type Plan = "free" | "startup" | "scale";

interface TOrganization {
  id: string;
  billing: {
    plan: Plan;
    limits: {
      monthly: {
        responses: number;
        miu: number;
      };
    };
  };
}

export const BILLING_LIMITS = {
  free: {
    RESPONSES: 1500,
    MIU: 2000,
  },
  startup: {
    RESPONSES: 5000,
    MIU: 7500,
  },
  scale: {
    RESPONSES: 10000,
    MIU: 30000,
  },
} as const;

export const updateOrgLimits: DataMigrationScript = {
  type: "data",
  id: "ax4otbz2f295rit6kn1jeu8l",
  name: "updateOrgLimits",
  run: async ({ tx }) => {
    // Your migration script goes here
    const organizations = (await tx.organization.findMany({
      where: {
        OR: [
          {
            AND: [
              {
                billing: {
                  path: ["plan"],
                  equals: "free",
                },
              },
              {
                billing: {
                  path: ["limits", "monthly", "miu"],
                  not: 2000,
                },
              },
              {
                billing: {
                  path: ["limits", "monthly", "responses"],
                  not: 1500,
                },
              },
            ],
          },
          {
            AND: [
              {
                billing: {
                  path: ["plan"],
                  equals: "startup",
                },
              },
              {
                billing: {
                  path: ["limits", "monthly", "miu"],
                  not: 7500,
                },
              },
              {
                billing: {
                  path: ["limits", "monthly", "responses"],
                  not: 5000,
                },
              },
            ],
          },
          {
            AND: [
              {
                billing: {
                  path: ["plan"],
                  equals: "scale",
                },
              },
              {
                billing: {
                  path: ["limits", "monthly", "miu"],
                  not: 30000,
                },
              },
              {
                billing: {
                  path: ["limits", "monthly", "responses"],
                  not: 10000,
                },
              },
            ],
          },
        ],
      },
      select: {
        id: true,
        billing: true,
      },
    })) as TOrganization[];

    const updationPromises = [];

    for (const organization of organizations) {
      const plan = organization.billing.plan;
      const limits = BILLING_LIMITS[plan];

      let billing = organization.billing;

      billing = {
        ...billing,
        limits: {
          ...billing.limits,
          monthly: {
            ...billing.limits.monthly,
            responses: limits.RESPONSES,
            miu: limits.MIU,
          },
        },
      };

      const updatePromise = tx.organization.update({
        where: {
          id: organization.id,
        },
        data: {
          billing,
        },
      });

      updationPromises.push(updatePromise);
    }

    await Promise.all(updationPromises);

    console.log(`Updated ${organizations.length.toString()} organizations`);
  },
};
