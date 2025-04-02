import { getApiKeys } from "@/modules/projects/settings/api-keys/lib/api-key";
import { getTranslate } from "@/tolgee/server";
import { getEnvironments } from "@formbricks/lib/environment/service";
import { getProjectByEnvironmentId } from "@formbricks/lib/project/service";
import { EditAPIKeys } from "./edit-api-keys";

interface ApiKeyListProps {
  environmentId: string;
  environmentType: string;
  isReadOnly: boolean;
}

export const ApiKeyList = async ({ environmentId, environmentType, isReadOnly }: ApiKeyListProps) => {
  const t = await getTranslate();
  const findEnvironmentByType = (environments, targetType) => {
    for (const environment of environments) {
      if (environment.type === targetType) {
        return environment.id;
      }
    }
    return null;
  };

  const project = await getProjectByEnvironmentId(environmentId);
  if (!project) {
    throw new Error(t("common.project_not_found"));
  }

  const environments = await getEnvironments(project.id);
  const environmentTypeId = findEnvironmentByType(environments, environmentType);
  const apiKeys = await getApiKeys(environmentTypeId);

  return (
    <EditAPIKeys
      environmentTypeId={environmentTypeId}
      environmentType={environmentType}
      apiKeys={apiKeys}
      environmentId={environmentId}
      isReadOnly={isReadOnly}
    />
  );
};
