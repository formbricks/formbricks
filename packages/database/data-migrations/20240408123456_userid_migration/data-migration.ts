import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.$transaction(
    async (tx) => {
      // get all the persons that have an attribute class with the name "userId"
      const personsWithUserIdAttribute = await tx.person.findMany({
        where: {
          attributes: {
            some: {
              attributeClass: {
                name: "userId",
              },
            },
          },
        },
        include: {
          attributes: {
            include: { attributeClass: true },
          },
        },
      });

      for (let person of personsWithUserIdAttribute) {
        // If the person already has a userId, skip it
        if (person.userId) {
          continue;
        }

        const userIdAttributeValue = person.attributes.find((attribute) => {
          if (attribute.attributeClass.name === "userId") {
            return attribute;
          }
        });

        if (!userIdAttributeValue) {
          continue;
        }

        await tx.person.update({
          where: {
            id: person.id,
          },
          data: {
            userId: userIdAttributeValue.value,
          },
        });
      }

      // Delete all attributeClasses with the name "userId"
      await tx.attributeClass.deleteMany({
        where: {
          name: "userId",
        },
      });
    },
    {
      timeout: 100000,
    }
  );
}
main()
  .catch(async (e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => await prisma.$disconnect());
