"use server";

import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client-middleware";
import { getOrganizationIdFromProductId } from "@/lib/utils/helper";
import { z } from "zod";
import { updateProduct } from "@formbricks/lib/product/service";
import { ZId } from "@formbricks/types/common";
import { ZProductUpdateInput } from "@formbricks/types/product";

const ZUpdateProductAction = z.object({
  productId: ZId,
  data: ZProductUpdateInput,
});

export const updateProductAction = authenticatedActionClient
  .schema(ZUpdateProductAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromProductId(parsedInput.productId),
      access: [
        {
          schema: ZProductUpdateInput,
          data: parsedInput.data,
          type: "organization",
          roles: ["owner", "manager"],
        },
        {
          type: "productTeam",
          productId: parsedInput.productId,
          minPermission: "manage",
        },
      ],
    });

    return await updateProduct(parsedInput.productId, parsedInput.data);
  });
