"use server";

import { z } from "zod";
import { authenticatedActionClient } from "@formbricks/lib/actionClient";
import { checkAuthorization } from "@formbricks/lib/actionClient/utils";
import { getOrganizationIdFromProductId } from "@formbricks/lib/organization/utils";
import { deleteProduct, getProducts, updateProduct } from "@formbricks/lib/product/service";
import { ZProductUpdateInput } from "@formbricks/types/product";

const ZUpdateProductAction = z.object({
  productId: z.string(),
  data: ZProductUpdateInput,
});

export const updateProductAction = async (props: z.infer<typeof ZUpdateProductAction>) =>
  authenticatedActionClient
    .schema(ZUpdateProductAction)
    .metadata({ rules: ["product", "update"] })
    // get organizationId from productId
    .use(async ({ ctx, next }) => {
      const organizationId = await getOrganizationIdFromProductId(props.productId);
      return next({ ctx: { ...ctx, organizationId } });
    })
    // check authorization
    .use(async ({ ctx, next, metadata }) => {
      await checkAuthorization({
        schema: ZProductUpdateInput,
        data: props.data,
        userId: ctx.user.id,
        organizationId: ctx.organizationId,
        rules: metadata.rules,
      });
      return next({ ctx });
    })
    // update product
    .action(async ({ parsedInput }) => await updateProduct(parsedInput.productId, parsedInput.data))(props);

const ZProductDeleteAction = z.object({
  productId: z.string(),
});

export const deleteProductAction = async (props: z.infer<typeof ZProductDeleteAction>) =>
  authenticatedActionClient
    .schema(ZProductDeleteAction)
    .metadata({ rules: ["product", "delete"] })
    // get organizationId from productId
    .use(async ({ ctx, next }) => {
      const organizationId = await getOrganizationIdFromProductId(props.productId);
      return next({ ctx: { ...ctx, organizationId } });
    })
    .use(async ({ ctx, next, metadata }) => {
      await checkAuthorization({
        userId: ctx.user.id,
        organizationId: ctx.organizationId,
        rules: metadata.rules,
      });
      return next({ ctx });
    })
    .action(async ({ ctx: { organizationId }, parsedInput }) => {
      const availableProducts = (await getProducts(organizationId)) ?? null;

      if (!!availableProducts && availableProducts?.length <= 1) {
        throw new Error("You can't delete the last product in the environment.");
      }

      // delete product
      return await deleteProduct(parsedInput.productId);
    })(props);
