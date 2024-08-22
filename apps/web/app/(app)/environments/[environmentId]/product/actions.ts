"use server";

import { z } from "zod";
import { authenticatedActionClient } from "@formbricks/lib/actionClient";
import { checkAuthorization } from "@formbricks/lib/actionClient/utils";
import { getOrganizationIdFromProductId } from "@formbricks/lib/organization/utils";
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
    await checkAuthorization({
      schema: ZProductUpdateInput,
      data: parsedInput.data,
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromProductId(parsedInput.productId),
      rules: ["product", "update"],
    });

    return await updateProduct(parsedInput.productId, parsedInput.data);
  });
