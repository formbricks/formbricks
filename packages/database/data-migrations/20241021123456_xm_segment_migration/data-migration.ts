/* eslint-disable @typescript-eslint/no-unnecessary-condition -- Required for a while loop here */

/* eslint-disable no-console -- logging is allowed in migration scripts */
import { PrismaClient } from "@prisma/client";
import type { TBaseFilters, TSegmentAttributeFilter, TSegmentFilter } from "@formbricks/types/segment";

const prisma = new PrismaClient();
const TRANSACTION_TIMEOUT = 30 * 60 * 1000; // 30 minutes in milliseconds

export const isResourceFilter = (resource: TSegmentFilter | TBaseFilters): resource is TSegmentFilter => {
  return (resource as TSegmentFilter).root !== undefined;
};

const findAndReplace = (filters: TBaseFilters): TBaseFilters => {
  const newFilters: TBaseFilters = [];
  for (const filter of filters) {
    if (isResourceFilter(filter.resource)) {
      let { root } = filter.resource;
      if (root.type === "attribute") {
        // @ts-expect-error -- Legacy type
        if (root.attributeClassName as string) {
          root = {
            type: "attribute",
            // @ts-expect-error -- Legacy type
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Legacy type
            contactAttributeKey: root.attributeClassName,
          };

          const newFilter = {
            ...filter.resource,
            root,
          } as TSegmentAttributeFilter;

          newFilters.push({
            ...filter,
            resource: newFilter,
          });
        }
      } else {
        newFilters.push(filter);
      }
    } else {
      const updatedResource = findAndReplace(filter.resource);
      newFilters.push({
        ...filter,
        resource: updatedResource,
      });
    }
  }

  return newFilters;
};

async function runMigration(): Promise<void> {
  const startTime = Date.now();
  console.log("Starting data migration...");

  await prisma.$transaction(
    async (tx) => {
      const allSegments = await tx.segment.findMany();
      const updationPromises = [];
      for (const segment of allSegments) {
        updationPromises.push(
          tx.segment.update({
            where: { id: segment.id },
            data: {
              filters: findAndReplace(segment.filters),
            },
          })
        );
      }

      await Promise.all(updationPromises);
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
