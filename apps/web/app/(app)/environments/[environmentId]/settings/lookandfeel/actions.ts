"use server";

import { updateProduct } from "@formbricks/lib/services/product";
import { TProductUpdateInput } from "@formbricks/types/v1/product";

export async function updateProductAction(inputProduct: Partial<TProductUpdateInput>, productId: string) {
  return await updateProduct(inputProduct, productId);
}
