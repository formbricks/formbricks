import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { err, ok } from "@formbricks/types/error-handlers";

export const getSegment = reactCache(async (segmentId: string) => {
  try {
    const segment = await prisma.segment.findUnique({
      where: { id: segmentId },
      select: {
        id: true,
        environmentId: true,
        filters: true,
      },
    });

    if (!segment) {
      return err({ type: "not_found", details: [{ field: "segment", issue: "not found" }] });
    }

    return ok(segment);
  } catch (error) {
    return err({ type: "internal_server_error", details: [{ field: "segment", issue: error.message }] });
  }
});
