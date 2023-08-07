import EditApiKeys from "./EditApiKeys";
import { getProductByEnvironmentId } from "@formbricks/lib/services/product";
import { getApiKeys } from "@formbricks/lib/services/apiKey";

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
  const environmentTypeId = findEnvironmentByType(product?.environments, environmentType);
  const apiKeyArray = await getApiKeys(environmentTypeId);

  return (
    <EditApiKeys
      environmentTypeId={environmentTypeId}
      environmentType={environmentType}
      apiKeyArray={apiKeyArray}
    />
  );
}
