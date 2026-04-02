/* eslint-disable @typescript-eslint/no-unsafe-call -- required for any type */
/* eslint-disable @typescript-eslint/no-unsafe-assignment -- required for any type */
/* eslint-disable @typescript-eslint/no-unsafe-member-access -- required for any type */
/* eslint-disable @typescript-eslint/no-explicit-any -- required for any type */
import type { MigrationScript } from "../../src/scripts/migration-runner";

export const isResourceFilter = (resource: any): boolean => {
  return resource.root !== undefined;
};

const findAndReplace = (filters: any): any => {
  const newFilters: any = [];
  for (const filter of filters) {
    if (isResourceFilter(filter.resource)) {
      let { root } = filter.resource;
      if (root.type === "attribute" && root.attributeClassName) {
        root = {
          type: "attribute",
          contactAttributeKey: root.attributeClassName,
        };
        const newFilter = {
          ...filter.resource,
          root,
        };

        newFilters.push({
          ...filter,
          resource: newFilter,
        });
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

export const xmSegmentMigration: MigrationScript = {
  type: "data",
  id: "s644oyyqccstfdeejc4fluye",
  name: "20241209110456_xm_segment_migration",
  run: async ({ tx }) => {
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
};
