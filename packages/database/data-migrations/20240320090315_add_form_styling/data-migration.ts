import { PrismaClient } from "@prisma/client";

const DEFAULT_BRAND_COLOR = "#64748b";
const DEFAULT_STYLING = {
  allowStyleOverwrite: true,
};

const prisma = new PrismaClient();

const main = async () => {
  await prisma.$transaction(
    async (tx) => {
      // product table with brand color and the highlight border color (if available)
      // styling object needs to be created for each product
      const products = await tx.product.findMany({
        include: { environments: { include: { surveys: true } } },
      });

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

          // for each survey in the product, we need to update the stying object with the brand color and the highlight border color
          for (const environment of product.environments) {
            for (const survey of environment.surveys) {
              const { styling } = product;
              const { brandColor, highlightBorderColor } = styling;

              if (!survey.styling) {
                continue;
              }

              const { styling: surveyStyling } = survey;
              const { hideProgressBar } = surveyStyling;

              await tx.survey.update({
                where: {
                  id: survey.id,
                },
                data: {
                  styling: {
                    ...(survey.styling ?? {}),
                    ...(brandColor &&
                      brandColor.light && {
                        brandColor: { light: brandColor.light },
                      }),
                    ...(highlightBorderColor?.light && {
                      highlightBorderColor: {
                        light: highlightBorderColor.light,
                      },
                    }),

                    // if the previous survey had the hideProgressBar set to true, we need to update the styling object with overwriteThemeStyling set to true
                    ...(hideProgressBar && {
                      overwriteThemeStyling: true,
                    }),
                  },
                },
              });

              // if the survey has product overwrites, we need to update the styling object with the brand color and the highlight border color
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
                      ...((brandColor ||
                        highlightBorderColor ||
                        Object.keys(survey.styling ?? {}).length > 0) && {
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
          }
        }
      }
    },
    {
      timeout: 50000,
    }
  );
};
main()
  .catch(async (e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => await prisma.$disconnect());
