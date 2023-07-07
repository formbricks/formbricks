// "use server";
// import { prisma } from "@formbricks/database";
// import { DatabaseError } from "@formbricks/errors";

// export const createActionClassServerAction = async (environmentId: string, eventClass) => {
//   try {
//     const result = await prisma.eventClass.create({
//       data: {
//         ...eventClass,
//         environment: { connect: { id: environmentId } },
//       },
//     });
//     return result;
//   } catch (error) {
//     throw new DatabaseError(`Database error when fetching webhooks for environment ${environmentId}`);
//   }
// };
