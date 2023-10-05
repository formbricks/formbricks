"use server";

import { updateProduct } from "@formbricks/lib/product/service";
import { TProductUpdateInput } from "@formbricks/types/v1/product";

export async function updateProductAction(productId: string, inputProduct: Partial<TProductUpdateInput>) {
  return await updateProduct(productId, inputProduct);
}
