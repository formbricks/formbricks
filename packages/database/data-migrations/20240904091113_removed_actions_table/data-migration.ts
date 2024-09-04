/* eslint-disable @typescript-eslint/restrict-template-expressions  -- using template strings for logging */

/* eslint-disable no-console -- logging is allowed in migration scripts */
import { PrismaClient } from "@prisma/client";
import type { TBaseFilter, TBaseFilters } from "@formbricks/types/segment";

const prisma = new PrismaClient();

function removeActionFilters(filters: TBaseFilters): TBaseFilters {
  return filters.reduce((acc: TBaseFilters, filter: TBaseFilter) => {
    if (Array.isArray(filter.resource)) {
      // If the resource is an array, it's a nested group of filters
      const cleanedGroup = removeActionFilters(filter.resource);
      if (cleanedGroup.length > 0) {
        acc.push({
          ...filter,
          resource: cleanedGroup,
        });
      }
      // @ts-expect-error -- we are checking for the older type
    } else if (filter.resource.root.type !== "action") {
      // If it's not an action filter, keep it
      acc.push(filter);
    }
    // Action filters are implicitly removed by not being added to acc
    return acc;
  }, []);
}

async function runMigration(): Promise<void> {
  await prisma.$transaction(
    async (tx) => {
      console.log("Starting the data migration...");

      const segmentsToUpdate = await tx.segment.findMany({
        where: {
          filters: {
            array_contains: {
              resource: {
                root: {
                  type: "action",
                },
              },
            },
          },
        },
      });

      console.log(`Found ${segmentsToUpdate.length} segments to update`);

      const updatePromises = segmentsToUpdate.map((segment) => {
        const updatedFilters = removeActionFilters(segment.filters);
        return tx.segment.update({
          where: { id: segment.id },
          data: { filters: updatedFilters },
        });
      });

      const updatedSegments = await Promise.all(updatePromises);
      console.log(`Successfully updated ${updatedSegments.length} segments`);
    },
    {
      timeout: 180000, // 3 minutes
    }
  );
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
