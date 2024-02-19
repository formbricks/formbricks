import { getProducts, updateProduct } from "@formbricks/lib/product/service";

export const unsubscribeLinkSurveyProFeatures = async (teamId: string) => {
  const productsOfTeam = await getProducts(teamId);
  for (const product of productsOfTeam) {
    if (!product.linkSurveyBranding) {
      await updateProduct(product.id, {
        linkSurveyBranding: true,
      });
    }
  }
};

export const unsubscribeCoreAndAppSurveyFeatures = async (teamId: string) => {
  const productsOfTeam = await getProducts(teamId);
  for (const product of productsOfTeam) {
    if (!product.inAppSurveyBranding) {
      await updateProduct(product.id, {
        inAppSurveyBranding: true,
      });
    }
  }
};
