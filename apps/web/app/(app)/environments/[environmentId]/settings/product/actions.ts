"use server";

import { Prisma } from "@prisma/client";
import { updateProduct } from "@formbricks/lib/services/product";
import { TProduct } from "@formbricks/types/v1/product";
import { getServerSession } from "next-auth";
import { AuthenticationError, ResourceNotFoundError } from "@formbricks/errors";
import { getEnvironment } from "@formbricks/lib/services/environment";
import { TEnvironment } from "@formbricks/types/v1/environment";
import { hasUserEnvironmentAccess } from "@/lib/api/apiHelper";

export const updateProductAction = async (
  environmentId: string,
  productId: string,
  data: Prisma.ProductUpdateInput
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
