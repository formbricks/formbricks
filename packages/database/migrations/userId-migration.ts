import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.$transaction(async (tx) => {
    const userIdAttributeClassIds = new Set<string>();

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
          // Store the attribute class id to delete it later
          userIdAttributeClassIds.add(attribute.attributeClass.id);

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

    // Delete all attributeClasses with the name "userId" that were collected in the Set
    for (const id of userIdAttributeClassIds) {
      await tx.attributeClass.delete({
        where: {
          id: id,
        },
      });
    }
  });
}
main()
  .catch(async (e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => await prisma.$disconnect());
