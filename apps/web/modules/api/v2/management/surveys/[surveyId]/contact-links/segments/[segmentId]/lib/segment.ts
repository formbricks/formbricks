import { ApiErrorResponseV2 } from "@/modules/api/v2/types/api-error";
import { Segment } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { cache } from "@formbricks/lib/cache";
import { segmentCache } from "@formbricks/lib/cache/segment";
import { Result, err, ok } from "@formbricks/types/error-handlers";

export const getSegment = reactCache(async (segmentId: string) =>
  cache(
    async (): Promise<Result<Pick<Segment, "id" | "environmentId" | "filters">, ApiErrorResponseV2>> => {
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
    },
    [`contact-link-getSegment-${segmentId}`],
    {
      tags: [segmentCache.tag.byId(segmentId)],
    }
  )()
);
