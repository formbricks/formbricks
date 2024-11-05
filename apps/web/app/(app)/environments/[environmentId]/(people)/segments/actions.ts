"use server";

import { checkAuthorizationUpdated } from "@/lib/utils/action-client-middleware";
import { getOrganizationIdFromSegmentId, getProductIdFromSegmentId } from "@/lib/utils/helper";
import { z } from "zod";
import { authenticatedActionClient } from "@formbricks/lib/actionClient";
import { deleteSegment, updateSegment } from "@formbricks/lib/segment/service";
import { ZId } from "@formbricks/types/common";
import { ZSegmentFilters, ZSegmentUpdateInput } from "@formbricks/types/segment";

const ZDeleteBasicSegmentAction = z.object({
  segmentId: ZId,
});

export const deleteBasicSegmentAction = authenticatedActionClient
  .schema(ZDeleteBasicSegmentAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromSegmentId(parsedInput.segmentId),
      access: [
        {
          type: "organization",
          rules: ["segment", "delete"],
        },
        {
          type: "productTeam",
          productId: await getProductIdFromSegmentId(parsedInput.segmentId),
          minPermission: "manage",
        },
      ],
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
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromSegmentId(parsedInput.segmentId),
      access: [
        {
          type: "organization",
          rules: ["segment", "update"],
        },
        {
          type: "productTeam",
          productId: await getProductIdFromSegmentId(parsedInput.segmentId),
          minPermission: "manage",
        },
      ],
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
