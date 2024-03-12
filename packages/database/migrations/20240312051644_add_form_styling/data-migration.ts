import { Prisma, PrismaClient } from "@prisma/client";

const DEFAULT_BRAND_COLOR = "#64748b";
const DEFAULT_STYLING = {
  unifiedStyling: false,
  allowStyleOverwrite: true,
};

const prisma = new PrismaClient();
async function main() {
  await prisma.$transaction(async (tx) => {
    // product table with brand color and the highlight border color (if available)
    // styling object needs to be created for each product
    const products = await tx.product.findMany({});
    if (!products) {
      // something went wrong, could not find any products
      return;
    }

    if (products.length) {
      for (const product of products) {
        // no migration needed
        // 1. product's brandColor is equal to the default one
        // 2. product's styling object is equal the default one
        // 3. product has no highlightBorderColor

        if (
          product.brandColor === DEFAULT_BRAND_COLOR &&
          JSON.stringify(product.styling) === JSON.stringify(DEFAULT_STYLING) &&
          !product.highlightBorderColor
        ) {
          continue;
        }

        await tx.product.update({
          where: {
            id: product.id,
          },
          data: {
            styling: {
              ...product.styling,
              // only if the brand color is not null and not equal to the default one, we need to update the styling object. Otherwise, we'll just use the default value
              ...(product.brandColor &&
                product.brandColor !== DEFAULT_BRAND_COLOR && {
                  brandColor: { light: product.brandColor },
                }),
              ...(product.highlightBorderColor && {
                highlightBorderColor: {
                  light: product.highlightBorderColor,
                },
              }),
            },
            brandColor: null,
            highlightBorderColor: null,
          },
        });
      }

      // find all surveys with product overwrites
      const surveysWithProductOverwrites = await tx.survey.findMany({
        where: {
          productOverwrites: { not: Prisma.JsonNull },
        },
      });

      if (!surveysWithProductOverwrites || !surveysWithProductOverwrites.length) {
        // no surveys with product overwrites found, return early
        return;
      }

      for (const survey of surveysWithProductOverwrites) {
        const { brandColor, highlightBorderColor } = survey.productOverwrites ?? {};

        // single query to update the survey with the product overwrites
        await tx.survey.update({
          where: { id: survey.id },
          data: {
            styling: {
              ...(survey.styling ?? {}),
              ...(brandColor && { brandColor: { light: brandColor } }),
              ...(highlightBorderColor && { highlightBorderColor: { light: highlightBorderColor } }),
            },
            productOverwrites: {
              brandColor: null,
              highlightBorderColor: null,
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
