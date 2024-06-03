import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const main = async () => {
  await prisma.$transaction(
    async (tx) => {
      const startTime = Date.now();
      console.log("Starting data migration...");

      const languages = await tx.language.updateMany({
        where: {
          code: {
            in: ["ar", "az", "dv", "fa", "he", "ku", "ur"],
          },
        },
        data: {
          rtl: true,
        },
      });

      console.log(`Updated ${languages.count} languages\n`);

      const endTime = Date.now();
      console.log(`Data migration completed. Total time: ${(endTime - startTime) / 1000}s`);
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
