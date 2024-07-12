import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.$transaction(
    async (tx) => {
      console.log("starting migration");
      const segmentsWithNoSurveys = await tx.segment.findMany({
        where: {
          surveys: {
            none: {},
          },
        },
      });

      const ids = segmentsWithNoSurveys.map((segment) => segment.id);

      await tx.segment.deleteMany({
        where: {
          id: {
            in: ids,
          },
        },
      });

      console.log(`Deleted ${segmentsWithNoSurveys.length} segments with no surveys`);
    },
    { timeout: 50000 }
  );
}

main()
  .catch(async (e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => await prisma.$disconnect());
