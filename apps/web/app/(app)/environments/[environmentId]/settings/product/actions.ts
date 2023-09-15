"use server";

import { deleteProduct, getProducts, updateProduct } from "@formbricks/lib/services/product";
import { TProduct, TProductUpdateInput } from "@formbricks/types/v1/product";
import { getServerSession } from "next-auth";
import { AuthenticationError, ResourceNotFoundError } from "@formbricks/types/v1/errors";
import { getEnvironment } from "@formbricks/lib/services/environment";
import { TEnvironment } from "@formbricks/types/v1/environment";
import { hasUserEnvironmentAccess } from "@/lib/api/apiHelper";
import { getTeamByEnvironmentId } from "@formbricks/lib/services/team";
import { getMembershipByUserId } from "@formbricks/lib/services/membership";

export const updateProductAction = async (
  environmentId: string,
  productId: string,
  data: Partial<TProductUpdateInput>
): Promise<TProduct> => {
  const session = await getServerSession();

  if (!session?.user) {
    throw new AuthenticationError("Not authenticated");
  }

  // get the environment from service and check if the user is allowed to update the product
  let environment: TEnvironment | null = null;

  try {
    environment = await getEnvironment(environmentId);

    if (!environment) {
      throw new ResourceNotFoundError("Environment", "Environment not found");
    }
  } catch (err) {
    throw err;
  }

  if (!hasUserEnvironmentAccess(session.user, environment.id)) {
    throw new AuthenticationError("You don't have access to this environment");
  }

  const updatedProduct = await updateProduct(productId, data);
  return updatedProduct;
};

export const deleteProductAction = async (environmentId: string, userId: string, productId: string) => {
  const session = await getServerSession();

  if (!session?.user) {
    throw new AuthenticationError("Not authenticated");
  }

  // get the environment from service and check if the user is allowed to update the product
  let environment: TEnvironment | null = null;

  try {
    environment = await getEnvironment(environmentId);

    if (!environment) {
      throw new ResourceNotFoundError("Environment", "Environment not found");
    }
  } catch (err) {
    throw err;
  }

  if (!hasUserEnvironmentAccess(session.user, environment.id)) {
    throw new AuthenticationError("You don't have access to this environment");
  }

  const team = await getTeamByEnvironmentId(environmentId);
  const membership = team ? await getMembershipByUserId(userId, team.id) : null;

  if (membership?.role !== "admin" && membership?.role !== "owner") {
    throw new AuthenticationError("You are not allowed to delete products.");
  }

  const availableProducts = team ? await getProducts(team.id) : null;

  if (!!availableProducts && availableProducts?.length <= 1) {
    throw new Error("You can't delete the last product in the environment.");
  }

  const deletedProduct = await deleteProduct(productId);
  return deletedProduct;
};
