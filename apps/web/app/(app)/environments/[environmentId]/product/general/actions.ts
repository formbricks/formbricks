"use server";

import { checkAuthorizationUpdated } from "@/lib/utils/action-client-middleware";
import { getOrganizationIdFromProductId } from "@/lib/utils/helper";
import { z } from "zod";
import { authenticatedActionClient } from "@formbricks/lib/actionClient";
import { deleteProduct, getProducts } from "@formbricks/lib/product/service";
import { ZId } from "@formbricks/types/common";

const ZProductDeleteAction = z.object({
  productId: ZId,
});

export const deleteProductAction = authenticatedActionClient
  .schema(ZProductDeleteAction)
  .action(async ({ ctx, parsedInput }) => {
    const organizationId = await getOrganizationIdFromProductId(parsedInput.productId);

    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: organizationId,
      access: [
        {
          type: "organization",
          rules: ["product", "delete"],
        },
      ],
    });

    const availableProducts = (await getProducts(organizationId)) ?? null;

    if (!!availableProducts && availableProducts?.length <= 1) {
      throw new Error("You can't delete the last product in the environment.");
    }

    // delete product
    return await deleteProduct(parsedInput.productId);
  });
