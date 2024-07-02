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
