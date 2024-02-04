"use server";

import { getServerSession } from "next-auth";

import { authOptions } from "@formbricks/lib/authOptions";
import { canUserAccessProduct, verifyUserRoleAccess } from "@formbricks/lib/product/auth";
import { getProduct, updateProduct } from "@formbricks/lib/product/service";
import { updateDefaultLanguageInSurveys } from "@formbricks/lib/survey/service";
import { AuthorizationError, ResourceNotFoundError } from "@formbricks/types/errors";
import { TLanguages, TProductUpdateInput } from "@formbricks/types/product";

export async function updateProductAction(productId: string, inputProduct: Partial<TProductUpdateInput>) {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const isAuthorized = await canUserAccessProduct(session.user?.id, productId);
  if (!isAuthorized) throw new AuthorizationError("Not authorized");

  const product = await getProduct(productId);

  const { hasCreateOrUpdateAccess } = await verifyUserRoleAccess(product!.teamId, session.user?.id);
  if (!hasCreateOrUpdateAccess) throw new AuthorizationError("Not authorized");

  return await updateProduct(productId, inputProduct);
}

export async function updateLangaugeAction(
  productId: string,
  languages: TLanguages,
  isDefaultSymbolChanged: boolean
) {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const isAuthorized = await canUserAccessProduct(session.user?.id, productId);
  if (!isAuthorized) throw new AuthorizationError("Not authorized");

  const product = await getProduct(productId);
  if (!product) {
    throw new ResourceNotFoundError("Product", productId);
  }

  const { hasCreateOrUpdateAccess } = await verifyUserRoleAccess(product!.teamId, session.user?.id);
  if (!hasCreateOrUpdateAccess) throw new AuthorizationError("Not authorized");
  if (isDefaultSymbolChanged) {
    updateDefaultLanguageInSurveys(productId, product?.languages["_default_"], languages["_default_"]);
  }
  return await updateProduct(productId, { languages });
}
