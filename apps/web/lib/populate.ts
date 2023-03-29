import { EventType } from "@prisma/client";
export const populateEnvironment = {
  eventClasses: {
    create: [
      {
        name: "New Session",
        description: "Gets fired when a new session is created",
        type: EventType.automatic,
      },
    ],
  },
  attributeClasses: {
    create: [
      { name: "userId", description: "The internal ID of the person", type: EventType.automatic },
      { name: "email", description: "The email of the person", type: EventType.automatic },
    ],
  },
};
