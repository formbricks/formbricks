"use server";

import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { updateProduct } from "@formbricks/lib/product/service";
import { updateProfile } from "@formbricks/lib/profile/service";
import { TProductUpdateInput } from "@formbricks/types/v1/product";
import { TProfileUpdateInput } from "@formbricks/types/v1/profile";
import { getServerSession } from "next-auth";
import { AuthorizationError } from "@formbricks/types/v1/errors";

export async function updateProfileAction(updatedProfile: Partial<TProfileUpdateInput>) {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  return await updateProfile(session.user.id, updatedProfile);
}

export async function updateProductAction(productId: string, updatedProduct: Partial<TProductUpdateInput>) {
  return await updateProduct(productId, updatedProduct);
}
