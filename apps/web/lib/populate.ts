export const populateEnvironment = {
  eventClasses: {
    create: [
      { name: "New Session", description: "Gets fired when a new session is created", type: "automatic" },
    ],
  },
  attributeClasses: {
    create: [
      { name: "userId", description: "The internal ID of the person", type: "automatic" },
      { name: "email", description: "The email of the person", type: "automatic" },
    ],
  },
};
