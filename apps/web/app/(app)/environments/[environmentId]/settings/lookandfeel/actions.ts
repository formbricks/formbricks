"use server";

import { authOptions } from "@formbricks/lib/authOptions";
import { updateProduct } from "@formbricks/lib/product/service";
import { TProductUpdateInput } from "@formbricks/types/v1/product";
import { getServerSession } from "next-auth";
import { AuthorizationError } from "@formbricks/types/v1/errors";
import { canUserAccessProduct } from "@formbricks/lib/product/auth";

export async function updateProductAction(productId: string, inputProduct: Partial<TProductUpdateInput>) {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const isAuthorized = await canUserAccessProduct(session.user.id, productId);
  if (!isAuthorized) throw new AuthorizationError("Not authorized");

  return await updateProduct(productId, inputProduct);
}
