import { getSegment } from "@/modules/ee/contacts/segments/lib/segments";
import { isResourceFilter } from "@/modules/ee/contacts/segments/lib/utils";
import { InvalidInputError } from "@formbricks/types/errors";
import { TBaseFilters } from "@formbricks/types/segment";

/**
 * Checks if a segment filter contains a recursive reference to itself
 * @param filters - The filters to check for recursive references
 * @param segmentId - The ID of the segment being checked
 * @throws {InvalidInputError} When a recursive segment filter is detected
 */
export const checkForRecursiveSegmentFilter = async (filters: TBaseFilters, segmentId: string) => {
  for (const filter of filters) {
    const { resource } = filter;
    if (isResourceFilter(resource)) {
      if (resource.root.type === "segment") {
        const { segmentId: segmentIdFromRoot } = resource.root;

        if (segmentIdFromRoot === segmentId) {
          throw new InvalidInputError("Recursive segment filter is not allowed");
        }

        const segment = await getSegment(segmentIdFromRoot);

        if (segment) {
          // recurse into this segment and check for recursive filters:
          const segmentFilters = segment.filters;

          if (segmentFilters) {
            await checkForRecursiveSegmentFilter(segmentFilters, segmentId);
          }
        }
      }
    } else {
      await checkForRecursiveSegmentFilter(resource, segmentId);
    }
  }
};
