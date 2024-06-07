import { getProducts, updateProduct } from "@formbricks/lib/product/service";

export const unsubscribeLinkSurveyProFeatures = async (organizationId: string) => {
  const productsOfOrganization = await getProducts(organizationId);
  for (const product of productsOfOrganization) {
    if (!product.linkSurveyBranding) {
      await updateProduct(product.id, {
        linkSurveyBranding: true,
      });
    }
  }
};

export const unsubscribeCoreAndAppSurveyFeatures = async (organizationId: string) => {
  const productsOfOrganization = await getProducts(organizationId);
  for (const product of productsOfOrganization) {
    if (!product.inAppSurveyBranding) {
      await updateProduct(product.id, {
        inAppSurveyBranding: true,
      });
    }
  }
};
