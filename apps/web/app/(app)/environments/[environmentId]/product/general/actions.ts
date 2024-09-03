"use server";

import { z } from "zod";
import { authenticatedActionClient } from "@formbricks/lib/actionClient";
import { checkAuthorization } from "@formbricks/lib/actionClient/utils";
import { getOrganizationIdFromProductId } from "@formbricks/lib/organization/utils";
import { deleteProduct, getProducts } from "@formbricks/lib/product/service";
import { ZId } from "@formbricks/types/common";

const ZProductDeleteAction = z.object({
  productId: ZId,
});

export const deleteProductAction = authenticatedActionClient
  .schema(ZProductDeleteAction)
  .action(async ({ ctx, parsedInput }) => {
    // get organizationId from productId
    const organizationId = await getOrganizationIdFromProductId(parsedInput.productId);

    await checkAuthorization({
      userId: ctx.user.id,
      organizationId: organizationId,
      rules: ["product", "delete"],
    });

    const availableProducts = (await getProducts(organizationId)) ?? null;

    if (!!availableProducts && availableProducts?.length <= 1) {
      throw new Error("You can't delete the last product in the environment.");
    }

    // delete product
    return await deleteProduct(parsedInput.productId);
  });
