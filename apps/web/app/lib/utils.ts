import { getServerSession } from "next-auth";
import { createSafeActionClient } from "next-safe-action";
import { ZodIssue, z } from "zod";
import { authOptions } from "@formbricks/lib/authOptions";
import { getMembershipByUserIdOrganizationId } from "@formbricks/lib/membership/service";
import { getProduct } from "@formbricks/lib/product/service";
import { AuthenticationError, AuthorizationError } from "@formbricks/types/errors";
import { TInvite } from "@formbricks/types/invites";

export const isInviteExpired = (invite: TInvite) => {
  const now = new Date();
  const expiresAt = new Date(invite.expiresAt);
  return now > expiresAt;
};

export const actionClient = createSafeActionClient({
  defineMetadataSchema() {
    return z.object({
      rules: z.tuple([
        z.enum(["product", "organization", "environment", "membership", "invite", "response", "survey"]),
        z.enum(["create", "read", "update", "delete"]),
      ]),
    });
  },
});

export const authenticatedActionClient = actionClient.use(async ({ next }) => {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    throw new AuthenticationError("Not authenticated");
  }
  return next({ ctx: { user: session.user } });
});

export const getOrganizationIdFromProductId = async (productId: string) => {
  const product = await getProduct(productId);
  if (!product) {
    throw new Error("Product not found");
  }

  return product.organizationId;
};

export const getMembershipRole = async (userId: string, organizationId: string) => {
  const membership = await getMembershipByUserIdOrganizationId(userId, organizationId);
  if (!membership) {
    throw new AuthorizationError("Not authorized");
  }

  return membership.role;
};

export const formatErrors = (errors: ZodIssue[]) => {
  return {
    ...errors.reduce((acc, error) => {
      acc[error.path.join(".")] = {
        _errors: [error.message],
      };
      return acc;
    }, {}),
  };
};
