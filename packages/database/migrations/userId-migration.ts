import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.$transaction(async (tx) => {
    let userIdAttributeClassId: string | null = null;
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
      // if the person already has a userId column, skip
      if (person.userId) {
        continue;
      }

      const userIdAttributeValue = person.attributes.find((attribute) => {
        if (attribute.attributeClass.name === "userId") {
          if (!userIdAttributeClassId) {
            // store the attribute class id to delete it later
            userIdAttributeClassId = attribute.attributeClass.id;
          }

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

    if (userIdAttributeClassId) {
      await tx.attributeClass.delete({
        where: {
          id: userIdAttributeClassId,
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
