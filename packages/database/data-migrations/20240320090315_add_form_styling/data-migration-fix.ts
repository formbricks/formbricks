import { Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.$transaction(async (tx) => {
    const surveysWithProductOverwrites = await tx.survey.findMany({
      where: {
        productOverwrites: {
          not: Prisma.JsonNull,
        },
      },
    });

    for (const survey of surveysWithProductOverwrites) {
      if (survey.productOverwrites) {
        const { brandColor, highlightBorderColor, ...rest } = survey.productOverwrites;

        await tx.survey.update({
          where: {
            id: survey.id,
          },
          data: {
            styling: {
              ...(survey.styling ?? {}),
              ...(brandColor && { brandColor: { light: brandColor } }),
              ...(highlightBorderColor && { highlightBorderColor: { light: highlightBorderColor } }),
              ...((brandColor || highlightBorderColor || Object.keys(survey.styling ?? {}).length > 0) && {
                overwriteThemeStyling: true,
              }),
            },
            productOverwrites: {
              ...rest,
            },
          },
        });
      }
    }
  });
}

main()
  .catch(async (e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => await prisma.$disconnect());
