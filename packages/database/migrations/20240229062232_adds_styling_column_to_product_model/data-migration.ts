import { PrismaClient } from "@prisma/client";

import { TStyling } from "@formbricks/types/styling";

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

    const updates = products.map(product => {
      if (product.styling !== null) {
        // styling object already exists for this product
        return;
      }
    
      const styling: TStyling = {
        unifiedStyling: true,
        allowStyleOverwrite: true,
        brandColor: {
          light: product.brandColor,
        },
        ...(product.highlightBorderColor && {
          highlightBorderColor: {
            light: product.highlightBorderColor,
            dark: product.highlightBorderColor,
          },
        }),
      };
    
      return tx.product.update({
        where: {
          id: product.id,
        },
        data: {
          styling,
        },
      });
    });
    
    await tx.$transaction(updates);
  });
}

main()
  .catch(async (e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => await prisma.$disconnect());
