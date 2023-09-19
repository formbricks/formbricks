"use server";

import { updateProduct } from "@formbricks/lib/services/product";
import { updateProfile } from "@formbricks/lib/services/profile";
import { TProductUpdateInput } from "@formbricks/types/v1/product";
import { TProfileUpdateInput } from "@formbricks/types/v1/profile";

export async function updateProfileAction(personId: string, updatedProfile: Partial<TProfileUpdateInput>) {
  return await updateProfile(personId, updatedProfile);
}

export async function updateProductAction(productId: string, updatedProduct: Partial<TProductUpdateInput>) {
  return await updateProduct(productId, updatedProduct);
}
