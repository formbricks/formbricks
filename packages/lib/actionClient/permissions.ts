import { ZProductUpdateInput } from "@formbricks/types/product";

export const Permissions = {
  owner: {
    environment: {
      read: true,
    },
    product: {
      create: true,
      read: true,
      update: true,
      delete: true,
    },
    organization: {
      read: true,
      update: true,
      delete: true,
    },
    membership: {
      create: true,
      update: true,
      delete: true,
    },
    person: {
      delete: true,
    },
    response: {
      read: true,
      update: true,
      delete: true,
    },
    survey: {
      create: true,
      update: true,
      read: true,
      delete: true,
    },
    tag: {
      create: true,
      update: true,
      delete: true,
    },
    responseNote: {
      create: true,
      update: true,
      delete: true,
    },
    segment: {
      create: true,
      read: true,
      update: true,
      delete: true,
    },
    actionClass: {
      create: true,
      delete: true,
    },
    integration: {
      create: true,
      update: true,
      delete: true,
    },
    webhook: {
      create: true,
      update: true,
      delete: true,
    },
    apiKey: {
      create: true,
      update: true,
      delete: true,
    },
    subscription: {
      create: true,
      read: true,
      update: true,
      delete: true,
    },
    invite: {
      create: true,
      read: true,
      update: true,
      delete: true,
    },
    language: {
      create: true,
      update: true,
      delete: true,
    },
  },

  admin: {
    environment: {
      read: true,
    },
    product: {
      create: true,
      read: true,
      update: true,
      delete: true,
    },
    organization: {
      read: true,
      update: true,
      delete: false,
    },
    membership: {
      create: true,
      update: true,
      delete: true,
    },
    person: {
      delete: true,
    },
    response: {
      read: true,
      update: true,
      delete: true,
    },
    survey: {
      create: true,
      read: true,
      update: true,
      delete: true,
    },
    tag: {
      create: true,
      update: true,
      delete: true,
    },
    responseNote: {
      create: true,
      update: true,
      delete: true,
    },
    segment: {
      create: true,
      read: true,
      update: true,
      delete: true,
    },
    actionClass: {
      create: true,
      delete: true,
    },
    integration: {
      create: true,
      update: true,
      delete: true,
    },
    webhook: {
      create: true,
      update: true,
      delete: true,
    },
    apiKey: {
      create: true,
      update: true,
      delete: true,
    },
    subscription: {
      create: true,
      read: true,
      update: true,
      delete: true,
    },
    invite: {
      create: true,
      read: true,
      update: true,
      delete: true,
    },
    language: {
      create: true,
      update: true,
      delete: true,
    },
  },

  editor: {
    environment: {
      read: true,
    },
    product: {
      create: false,
      read: true,
      update: true,
      delete: true,
    },
    organization: {
      read: true,
      update: false,
      delete: false,
    },
    membership: {
      create: false,
      update: false,
      delete: false,
    },
    person: {
      delete: true,
    },
    response: {
      read: true,
      update: true,
      delete: true,
    },
    survey: {
      create: true,
      read: true,
      update: true,
      delete: true,
    },
    tag: {
      create: true,
      update: true,
      delete: true,
    },
    responseNote: {
      create: true,
      update: true,
      delete: true,
    },
    segment: {
      create: true,
      read: true,
      update: true,
      delete: true,
    },
    actionClass: {
      create: true,
      delete: true,
    },
    integration: {
      create: true,
      update: true,
      delete: true,
    },
    webhook: {
      create: true,
      update: true,
      delete: true,
    },
    apiKey: {
      create: true,
      update: true,
      delete: true,
    },
    subscription: {
      create: false,
      read: false,
      update: false,
      delete: false,
    },
    invite: {
      create: false,
      read: false,
      update: false,
      delete: false,
    },
    language: {
      create: false,
      update: false,
      delete: false,
    },
  },

  developer: {
    environment: {
      read: true,
    },
    product: {
      create: false,
      read: true,
      update: ZProductUpdateInput.omit({
        name: true,
      }),
      delete: true,
    },
    organization: {
      read: true,
      update: false,
      delete: false,
    },
    membership: {
      create: false,
      update: false,
      delete: false,
    },
    person: {
      delete: true,
    },
    response: {
      read: true,
      update: true,
      delete: true,
    },
    survey: {
      create: true,
      read: true,
      update: true,
      delete: true,
    },
    tag: {
      create: true,
      update: true,
      delete: true,
    },
    responseNote: {
      create: true,
      update: true,
      delete: true,
    },
    segment: {
      create: true,
      read: true,
      update: true,
      delete: true,
    },
    actionClass: {
      create: true,
      delete: true,
    },
    integration: {
      create: true,
      update: true,
      delete: true,
    },
    webhook: {
      create: true,
      update: true,
      delete: true,
    },
    apiKey: {
      create: true,
      update: true,
      delete: true,
    },
    subscription: {
      create: false,
      read: false,
      update: false,
      delete: false,
    },
    invite: {
      create: false,
      read: false,
      update: false,
      delete: false,
    },
    language: {
      create: false,
      update: false,
      delete: false,
    },
  },

  viewer: {
    environment: {
      read: true,
    },
    product: {
      create: false,
      read: true,
      update: false,
      delete: false,
    },
    organization: {
      read: false,
      update: false,
      delete: false,
    },
    membership: {
      create: false,
      update: false,
      delete: false,
    },
    person: {
      delete: false,
    },
    response: {
      read: true,
      update: false,
      delete: false,
    },
    survey: {
      create: false,
      read: true,
      update: false,
      delete: false,
    },
    tag: {
      create: false,
      update: false,
      delete: false,
    },
    responseNote: {
      create: false,
      update: false,
      delete: false,
    },
    segment: {
      create: false,
      read: true,
      update: false,
      delete: false,
    },
    actionClass: {
      create: false,
      delete: false,
    },
    integration: {
      create: false,
      update: true,
      delete: false,
    },
    webhook: {
      create: false,
      update: false,
      delete: false,
    },
    apiKey: {
      create: false,
      update: false,
      delete: false,
    },
    subscription: {
      create: false,
      read: false,
      update: false,
      delete: false,
    },
    invite: {
      create: false,
      read: false,
      update: false,
      delete: false,
    },
    language: {
      create: false,
      update: false,
      delete: false,
    },
  },
};
