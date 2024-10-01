/* eslint-disable @typescript-eslint/restrict-template-expressions  -- using template strings for logging */

/* eslint-disable no-console -- logging is allowed in migration scripts */
import { PrismaClient } from "@prisma/client";
import type { TBaseFilter, TBaseFilters } from "@formbricks/types/segment";

const prisma = new PrismaClient();

function removeActionFilters(filters: TBaseFilters): TBaseFilters {
  const cleanedFilters = filters.reduce((acc: TBaseFilters, filter: TBaseFilter) => {
    if (Array.isArray(filter.resource)) {
      // If it's a group, recursively clean it
      const cleanedGroup = removeActionFilters(filter.resource);
      if (cleanedGroup.length > 0) {
        acc.push({
          ...filter,
          resource: cleanedGroup,
        });
      }
      // @ts-expect-error -- we're checking for an older type of filter
    } else if (filter.resource.root.type !== "action") {
      // If it's not an action filter, keep it
      acc.push(filter);
    }
    // Action filters are implicitly removed by not being added to acc
    return acc;
  }, []);

  // Ensure the first filter in the group has a null connector
  return cleanedFilters.map((filter, index) => {
    if (index === 0) {
      return { ...filter, connector: null };
    }
    return filter;
  });
}

async function runMigration(): Promise<void> {
  await prisma.$transaction(
    async (tx) => {
      console.log("Starting the data migration...");

      const segmentsToUpdate = await tx.segment.findMany({});

      console.log(`Found ${segmentsToUpdate.length} total segments`);

      let changedFiltersCount = 0;

      const updatePromises = segmentsToUpdate.map((segment) => {
        const updatedFilters = removeActionFilters(segment.filters);
        if (JSON.stringify(segment.filters) !== JSON.stringify(updatedFilters)) {
          changedFiltersCount++;
        }

        return tx.segment.update({
          where: { id: segment.id },
          data: { filters: updatedFilters },
        });
      });

      await Promise.all(updatePromises);
      console.log(`Successfully updated ${changedFiltersCount} segments`);
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
