import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.$transaction(
    async (tx) => {
      // get all the persons that have an attribute class with the name "userId"
      // const personsWithUserIdAttribute = await tx.person.findMany({
      //   where: {
      //     attributes: {
      //       some: {
      //         attributeClass: {
      //           name: "userId",
      //         },
      //       },
      //     },
      //   },
      //   include: {
      //     attributes: {
      //       include: { attributeClass: true },
      //     },
      //   },
      // });
      let updatedPeopleCount = 0;
      let notUpdatedPeopleCount = 0;

      let userIdSameCount = 0;
      let userIdDifferentCount = 0;

      const userIdAttributeClasses = await tx.attributeClass.findMany({
        where: {
          name: "userId",
        },
        include: {
          attributes: {
            include: { person: true },
          },
        },
      });

      console.log("FOUND " + userIdAttributeClasses.length + " userId attribute classes");

      for (let attributeClass of userIdAttributeClasses) {
        for (let attribute of attributeClass.attributes) {
          if (attribute.person.userId) {
            if (attribute.person.userId === attribute.value) {
              userIdSameCount += 1;
            } else {
              userIdDifferentCount += 1;
            }

            notUpdatedPeopleCount += 1;
            continue;
          }

          await tx.person.update({
            where: {
              id: attribute.personId,
            },
            data: {
              userId: attribute.value,
            },
          });

          updatedPeopleCount += 1;
        }
      }

      console.log("userIdSameCount " + userIdSameCount);
      console.log("userIdDifferentCount " + userIdDifferentCount);

      console.log("NOT UPDATED " + notUpdatedPeopleCount + " people");
      console.log("Updated " + updatedPeopleCount + " people");
      console.log("DONE!");

      // for (let person of personsWithUserIdAttribute) {
      //   // If the person already has a userId, skip it
      //   if (person.userId) {
      //     continue;
      //   }

      //   const userIdAttributeValue = person.attributes.find((attribute) => {
      //     if (attribute.attributeClass.name === "userId") {
      //       return attribute;
      //     }
      //   });

      //   if (!userIdAttributeValue) {
      //     continue;
      //   }

      //   await tx.person.update({
      //     where: {
      //       id: person.id,
      //     },
      //     data: {
      //       userId: userIdAttributeValue.value,
      //     },
      //   });
      // }

      // Delete all attributeClasses with the name "userId"
      // await tx.attributeClass.deleteMany({
      //   where: {
      //     name: "userId",
      //   },
      // });
    },
    {
      timeout: 60000 * 3, // 3 minutes
    }
  );
}
main()
  .catch(async (e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => await prisma.$disconnect());
