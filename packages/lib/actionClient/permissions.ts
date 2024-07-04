import { ZProductUpdateInput } from "@formbricks/types/product";

export const Permissions = {
  owner: {
    product: {
      create: true,
      read: true,
      update: true,
      delete: true,
    },
    organization: {
      update: true,
    },
    person: {
      delete: true,
    },
    response: {
      delete: true,
    },
    survey: {
      create: true,
    },
  },

  admin: {
    product: {
      create: true,
      read: true,
      update: true,
      delete: true,
    },
    organization: {
      update: true,
    },
    person: {
      delete: true,
    },
    response: {
      delete: true,
    },
    survey: {
      create: true,
    },
  },

  editor: {
    product: {
      create: true,
      read: true,
      update: true,
      delete: true,
    },
    organization: {
      update: false,
    },
    person: {
      delete: true,
    },
    response: {
      delete: true,
    },
    survey: {
      create: true,
    },
  },

  developer: {
    product: {
      create: true,
      read: true,
      update: ZProductUpdateInput.omit({
        name: true,
      }),
      delete: true,
    },
    organization: {
      update: false,
    },
    person: {
      delete: true,
    },
    response: {
      delete: true,
    },
    survey: {
      create: true,
    },
  },

  viewer: {
    product: {
      create: false,
      read: true,
      update: false,
      delete: false,
    },
    organization: {
      update: false,
    },
    person: {
      delete: false,
    },
    response: {
      delete: false,
    },
    survey: {
      create: false,
    },
  },
};
