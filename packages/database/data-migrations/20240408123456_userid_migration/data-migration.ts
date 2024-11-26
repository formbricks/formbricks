import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const main = async () => {
  await prisma.$transaction(
    async (tx) => {
      // get all the persons that have an attribute class with the name "userId"
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

      for (let attributeClass of userIdAttributeClasses) {
        for (let attribute of attributeClass.attributes) {
          if (attribute.person.userId) {
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
        }
      }

      console.log("Migrated userIds to the person table.");

      // Delete all attributeClasses with the name "userId"
      await tx.attributeClass.deleteMany({
        where: {
          name: "userId",
        },
      });

      console.log("Deleted attributeClasses with the name 'userId'.");
    },
    {
      timeout: 60000 * 3, // 3 minutes
    }
  );
};
main()
  .catch(async (e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => await prisma.$disconnect());
