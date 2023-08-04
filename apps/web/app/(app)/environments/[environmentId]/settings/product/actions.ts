"use server";

import { Prisma } from "@prisma/client";
import { updateProduct } from "@formbricks/lib/services/product";
import { TProduct } from "@formbricks/types/v1/product";

export const updateProductAction = async (
  productId: string,
  data: Prisma.ProductUpdateInput
): Promise<TProduct> => {
  const updatedProduct = await updateProduct(productId, data);
  return updatedProduct;
};
