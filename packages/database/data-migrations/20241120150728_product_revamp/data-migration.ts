/* eslint-disable no-console -- logging is allowed in migration scripts */
import { Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const TRANSACTION_TIMEOUT = 3 * 60 * 1000; // 3 minutes in milliseconds

type Plan = "free" | "startup" | "scale" | "enterprise";

const projectsLimitByPlan: Record<Plan, number | null> = {
  free: 3,
  startup: 3,
  scale: 5,
  enterprise: null,
};

async function runMigration(): Promise<void> {
  const startTime = Date.now();
  console.log("Starting data migration...");

  await prisma.$transaction(
    async (transactionPrisma) => {
      const organizations = await transactionPrisma.organization.findMany({
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
        transactionPrisma.organization.update({
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
