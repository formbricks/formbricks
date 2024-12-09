/* eslint-disable @typescript-eslint/no-unsafe-assignment -- required for any type */

/* eslint-disable @typescript-eslint/no-unsafe-member-access -- required for any type */

/* eslint-disable @typescript-eslint/no-explicit-any -- required for any type */
import type { DataMigrationScript } from "../../types/migration-runner";

export const isResourceFilter = (resource: any): boolean => {
  return resource.root !== undefined;
};

const findAndReplace = (filters: any): any => {
  const newFilters: any[] = [];
  for (const filter of filters) {
    if (isResourceFilter(filter.resource)) {
      let { root } = filter.resource;
      if (root.type === "attribute") {
        if (root.attributeClassName as string) {
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

export const xmSegmentMigration: DataMigrationScript = {
  id: "s644oyyqccstfdeejc4fluye",
  name: "xmSegmentMigration",
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
