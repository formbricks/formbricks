"use server";

import { z } from "zod";
import { authenticatedActionClient } from "@formbricks/lib/actionClient";
import { checkAuthorization } from "@formbricks/lib/actionClient/utils";
import { getOrganizationIdFromSegmentId } from "@formbricks/lib/organization/utils";
import { deleteSegment, updateSegment } from "@formbricks/lib/segment/service";
import { ZId } from "@formbricks/types/common";
import { ZSegmentFilters, ZSegmentUpdateInput } from "@formbricks/types/segment";

const ZDeleteBasicSegmentAction = z.object({
  segmentId: ZId,
});

export const deleteBasicSegmentAction = authenticatedActionClient
  .schema(ZDeleteBasicSegmentAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorization({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromSegmentId(parsedInput.segmentId),
      rules: ["segment", "delete"],
    });

    return await deleteSegment(parsedInput.segmentId);
  });

const ZUpdateBasicSegmentAction = z.object({
  segmentId: ZId,
  data: ZSegmentUpdateInput,
});

export const updateBasicSegmentAction = authenticatedActionClient
  .schema(ZUpdateBasicSegmentAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorization({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromSegmentId(parsedInput.segmentId),
      rules: ["segment", "update"],
    });

    const { filters } = parsedInput.data;
    if (filters) {
      const parsedFilters = ZSegmentFilters.safeParse(filters);

      if (!parsedFilters.success) {
        const errMsg =
          parsedFilters.error.issues.find((issue) => issue.code === "custom")?.message || "Invalid filters";
        throw new Error(errMsg);
      }
    }

    return await updateSegment(parsedInput.segmentId, parsedInput.data);
  });
