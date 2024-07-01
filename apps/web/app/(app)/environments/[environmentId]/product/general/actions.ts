"use server";

import { getRoleBasedSchema } from "@/app/lib/ruleEngine";
import {
  authenticatedActionClient,
  formatErrors,
  getMembershipRole,
  getOrganizationIdFromProductId,
} from "@/app/lib/utils";
import { getServerSession } from "next-auth";
import { returnValidationErrors } from "next-safe-action";
import { authOptions } from "@formbricks/lib/authOptions";
import { hasUserEnvironmentAccess } from "@formbricks/lib/environment/auth";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { getMembershipByUserIdOrganizationId } from "@formbricks/lib/membership/service";
import { getOrganizationByEnvironmentId } from "@formbricks/lib/organization/service";
import { deleteProduct, getProducts, updateProduct } from "@formbricks/lib/product/service";
import { TEnvironment } from "@formbricks/types/environment";
import { AuthenticationError, AuthorizationError, ResourceNotFoundError } from "@formbricks/types/errors";
import { TProduct, TProductUpdateInput, ZProductUpdateInput } from "@formbricks/types/product";

export const updateProductAction = async (
  environmentId: string,
  productId: string,
  data: TProductUpdateInput
): Promise<TProduct> => {
  const session = await getServerSession(authOptions);

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

  if (!hasUserEnvironmentAccess(session.user.id, environment.id)) {
    throw new AuthorizationError("Not authorized");
  }

  const organization = await getOrganizationByEnvironmentId(environmentId);
  const membership = organization
    ? await getMembershipByUserIdOrganizationId(session.user.id, organization.id)
    : null;

  if (!membership) {
    throw new AuthorizationError("Not authorized");
  }

  if (membership.role === "viewer") {
    throw new AuthorizationError("Not authorized");
  }

  if (membership.role === "developer") {
    if (!!data.name || !!data.organizationId || !!data.environments) {
      throw new AuthorizationError("Not authorized");
    }
  }

  const updatedProduct = await updateProduct(productId, data);
  return updatedProduct;
};

export const deleteProductAction = async (environmentId: string, productId: string) => {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    throw new AuthenticationError("Not authenticated");
  }
  const userId = session.user.id;
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

  if (!hasUserEnvironmentAccess(session.user.id, environment.id)) {
    throw new AuthorizationError("Not authorized");
  }

  const organization = await getOrganizationByEnvironmentId(environmentId);
  const membership = organization ? await getMembershipByUserIdOrganizationId(userId, organization.id) : null;

  if (membership?.role !== "admin" && membership?.role !== "owner") {
    throw new AuthorizationError("You are not allowed to delete products.");
  }

  const availableProducts = organization ? await getProducts(organization.id) : null;

  if (!!availableProducts && availableProducts?.length <= 1) {
    throw new Error("You can't delete the last product in the environment.");
  }

  const deletedProduct = await deleteProduct(productId);
  return deletedProduct;
};

export const protectedUpdateProductAction = async (productId: string, data: TProductUpdateInput) => {
  const actionResult = authenticatedActionClient
    .schema(ZProductUpdateInput)
    .metadata({ rules: ["product", "update"] })
    .use(async ({ ctx, next }) => {
      const organizationId = await getOrganizationIdFromProductId(productId);
      return next({ ctx: { ...ctx, organizationId } });
    })
    .use(async ({ ctx, next, metadata }) => {
      const role = await getMembershipRole(ctx.user.id, ctx.organizationId);
      const schema = getRoleBasedSchema(ZProductUpdateInput, role, ...metadata.rules);
      return next({ ctx: { ...ctx, schema } });
    })
    .action(async ({ parsedInput, ctx }) => {
      const { schema } = ctx;
      const parsedResult = schema.safeParse(parsedInput);
      if (!parsedResult.success) {
        console.log(parsedResult.error.errors, parsedResult.error.issues);
        return returnValidationErrors(schema, formatErrors(parsedResult.error.issues));
      }
      return await updateProduct(productId, parsedInput);
    })(data);

  return actionResult;
};
