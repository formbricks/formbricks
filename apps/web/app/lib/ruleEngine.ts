import z from "zod";
import { AuthorizationError } from "@formbricks/types/errors";
import { TMembershipRole } from "@formbricks/types/memberships";
import { ZProductUpdateInput } from "@formbricks/types/product";

export const Roles = {
  owner: {
    product: {
      create: true,
      read: true,
      update: true,
      delete: true,
    },
  },
  admin: {
    product: {
      create: true,
      read: true,
      update: true,
      delete: true,
    },
  },
  editor: {
    product: {
      create: true,
      read: true,
      update: true,
      delete: true,
    },
  },
  developer: {
    product: {
      create: true,
      read: true,
      update: ZProductUpdateInput.omit({
        name: true,
        inAppSurveyBranding: true,
      }).strict(),
      delete: true,
    },
  },
  viewer: {
    product: {
      create: false,
      read: true,
      update: false,
      delete: false,
    },
  },
};

export const getRoleBasedSchema = <T extends z.ZodRawShape>(
  schema: z.ZodObject<T>,
  role: TMembershipRole,
  entity: string,
  action: "create" | "read" | "update" | "delete"
): z.ZodObject<T> => {
  const data = Roles[role][entity][action];

  if (typeof data === "boolean" && !data) {
    throw new AuthorizationError("Not authorized");
  }
  return typeof data === "boolean" && data === true ? schema : data;
};
