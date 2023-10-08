import EditApiKeys from "./EditApiKeys";
import { getProductByEnvironmentId } from "@formbricks/lib/product/service";
import { getApiKeys } from "@formbricks/lib/apiKey/service";
import { getEnvironments } from "@formbricks/lib/environment/service";

export default async function ApiKeyList({
  environmentId,
  environmentType,
}: {
  environmentId: string;
  environmentType: string;
}) {
  const findEnvironmentByType = (environments, targetType) => {
    for (const environment of environments) {
      if (environment.type === targetType) {
        return environment.id;
      }
    }
    return null;
  };

  const product = await getProductByEnvironmentId(environmentId);
  if (!product) {
    throw new Error("Product not found");
  }

  const environments = await getEnvironments(product.id);
  const environmentTypeId = findEnvironmentByType(environments, environmentType);
  const apiKeys = await getApiKeys(environmentTypeId);

  return (
    <EditApiKeys
      environmentTypeId={environmentTypeId}
      environmentType={environmentType}
      apiKeys={apiKeys}
      environmentId={environmentId}
    />
  );
}
