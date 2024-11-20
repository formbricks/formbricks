/* eslint-disable no-console -- logging is allowed in migration scripts */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const TRANSACTION_TIMEOUT = 3 * 60 * 1000; // 3 minutes in milliseconds

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

async function runMigration(): Promise<void> {
  const startTime = Date.now();
  console.log("Starting data migration...");

  await prisma.$transaction(
    async (transactionPrisma) => {
      const organizations = (await transactionPrisma.organization.findMany({
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

        const updatePromise = transactionPrisma.organization.update({
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
    {
      timeout: TRANSACTION_TIMEOUT,
    }
  );

  const endTime = Date.now();
  console.log(`Data migration completed. Total time: ${((endTime - startTime) / 1000).toFixed(2)}s`);
}

function handleError(error: unknown): void {
  console.error("An error occurred during migration:", error);
  process.exit(1);
}

function handleDisconnectError(): void {
  console.error("Failed to disconnect Prisma client");
  process.exit(1);
}

function main(): void {
  runMigration()
    .catch(handleError)
    .finally(() => {
      prisma.$disconnect().catch(handleDisconnectError);
    });
}

main();
