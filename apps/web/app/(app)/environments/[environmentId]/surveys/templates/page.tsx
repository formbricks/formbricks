import TemplateContainerWithPreview from "./TemplateContainer";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { getProductByEnvironmentId } from "@formbricks/lib/product/service";

export default async function SurveyTemplatesPage({ params }) {
  const environmentId = params.environmentId;
  const environment = await getEnvironment(environmentId);
  const product = await getProductByEnvironmentId(environmentId);

  if (!product) {
    throw new Error("Product not found");
  }

  if (!environment) {
    throw new Error("Environment not found");
  }

  return (
    <TemplateContainerWithPreview environmentId={environmentId} environment={environment} product={product} />
  );
}
