import EditApiKeys from "./EditApiKeys";
import { getProductByEnvironmentId } from "@formbricks/lib/services/product";
import { getApiKeys } from "@formbricks/lib/services/apiKey";
import { getEnvironments } from "@formbricks/lib/services/environment";

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
