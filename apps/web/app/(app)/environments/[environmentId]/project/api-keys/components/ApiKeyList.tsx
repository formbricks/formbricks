import { getTranslations } from "next-intl/server";
import { getApiKeys } from "@formbricks/lib/apiKey/service";
import { getEnvironments } from "@formbricks/lib/environment/service";
import { getProjectByEnvironmentId } from "@formbricks/lib/project/service";
import { TUserLocale } from "@formbricks/types/user";
import { EditAPIKeys } from "./EditApiKeys";

export const ApiKeyList = async ({
  environmentId,
  environmentType,
  locale,
  isReadOnly,
}: {
  environmentId: string;
  environmentType: string;
  locale: TUserLocale;
  isReadOnly: boolean;
}) => {
  const t = await getTranslations();
  const findEnvironmentByType = (environments, targetType) => {
    for (const environment of environments) {
      if (environment.type === targetType) {
        return environment.id;
      }
    }
    return null;
  };

  const product = await getProjectByEnvironmentId(environmentId);
  if (!product) {
    throw new Error(t("common.product_not_found"));
  }

  const environments = await getEnvironments(product.id);
  const environmentTypeId = findEnvironmentByType(environments, environmentType);
  const apiKeys = await getApiKeys(environmentTypeId);

  return (
    <EditAPIKeys
      environmentTypeId={environmentTypeId}
      environmentType={environmentType}
      apiKeys={apiKeys}
      environmentId={environmentId}
      locale={locale}
      isReadOnly={isReadOnly}
    />
  );
};
