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
      read: true,
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
    team: {
      create: true,
      read: true,
      update: true,
      delete: true,
    },
    teamMembership: {
      create: true,
      read: true,
      update: true,
      delete: true,
    },
    productTeam: {
      create: true,
      update: true,
      delete: true,
    },
  },

  manager: {
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
      read: true,
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
    team: {
      create: true,
      read: true,
      update: true,
      delete: true,
    },
    teamMembership: {
      create: true,
      read: true,
      update: true,
      delete: true,
    },
    productTeam: {
      create: true,
      update: true,
      delete: true,
    },
  },

  billing: {
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
      read: false,
      delete: false,
    },
    response: {
      read: false,
      update: false,
      delete: false,
    },
    survey: {
      create: false,
      read: false,
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
      read: false,
      update: false,
      delete: false,
    },
    actionClass: {
      create: false,
      delete: false,
    },
    integration: {
      create: false,
      update: false,
      delete: false,
    },
    webhook: {
      create: false,
      update: false,
      delete: false,
    },
    apiKey: {
      create: false,
      delete: false,
    },
    subscription: {
      create: true,
      read: true,
      update: true,
      delete: true,
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
    team: {
      create: false,
      read: true,
      update: false,
      delete: false,
    },
    teamMembership: {
      create: false,
      read: false,
      update: false,
      delete: false,
    },
    productTeam: {
      create: false,
      update: false,
      delete: false,
    },
  },

  member: {
    environment: {
      read: true,
    },
    product: {
      create: false,
      read: true,
      update: true,
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
      read: true,
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
      create: true,
      update: true,
      delete: true,
    },
    team: {
      create: false,
      read: true,
      update: false,
      delete: false,
    },
    teamMembership: {
      create: true,
      read: true,
      update: true,
      delete: true,
    },
    productTeam: {
      create: false,
      update: false,
      delete: false,
    },
  },
};
