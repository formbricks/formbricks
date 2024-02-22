"use server";

import { getServerSession } from "next-auth";

import { authOptions } from "@formbricks/lib/authOptions";
import { createLanguage, deleteLanguage, updateLanguage } from "@formbricks/lib/language/service";
import { canUserAccessProduct, verifyUserRoleAccess } from "@formbricks/lib/product/auth";
import { getProduct } from "@formbricks/lib/product/service";
import { AuthorizationError } from "@formbricks/types/errors";
import { TLanguageInput } from "@formbricks/types/product";

export async function createLanguageAction(
  productId: string,
  environmentId: string,
  languageInput: TLanguageInput
) {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const isAuthorized = await canUserAccessProduct(session.user?.id, productId);
  if (!isAuthorized) throw new AuthorizationError("Not authorized");

  const product = await getProduct(productId);

  const { hasCreateOrUpdateAccess } = await verifyUserRoleAccess(product!.teamId, session.user?.id);
  if (!hasCreateOrUpdateAccess) throw new AuthorizationError("Not authorized");

  return await createLanguage(productId, environmentId, languageInput);
}

export async function deleteLanguageAction(productId: string, environmentId: string, languageId: string) {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const isAuthorized = await canUserAccessProduct(session.user?.id, productId);
  if (!isAuthorized) throw new AuthorizationError("Not authorized");

  const product = await getProduct(productId);

  const { hasCreateOrUpdateAccess } = await verifyUserRoleAccess(product!.teamId, session.user?.id);
  if (!hasCreateOrUpdateAccess) throw new AuthorizationError("Not authorized");

  return await deleteLanguage(productId, environmentId, languageId);
}

export async function updateLanguageAction(
  productId: string,
  environmentId: string,
  languageId: string,
  languageInput: TLanguageInput
) {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const isAuthorized = await canUserAccessProduct(session.user?.id, productId);
  if (!isAuthorized) throw new AuthorizationError("Not authorized");

  const product = await getProduct(productId);

  const { hasCreateOrUpdateAccess } = await verifyUserRoleAccess(product!.teamId, session.user?.id);
  if (!hasCreateOrUpdateAccess) throw new AuthorizationError("Not authorized");

  return await updateLanguage(productId, environmentId, languageId, languageInput);
}
