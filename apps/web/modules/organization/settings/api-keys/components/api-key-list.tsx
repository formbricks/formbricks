import { TUserLocale } from "@formbricks/types/user";
import { getApiKeysWithEnvironmentPermissions } from "@/modules/organization/settings/api-keys/lib/api-key";
import { TOrganizationWorkspace } from "@/modules/organization/settings/api-keys/types/api-keys";
import { EditAPIKeys } from "./edit-api-keys";

interface ApiKeyListProps {
  organizationId: string;
  locale: TUserLocale;
  workspaces: TOrganizationWorkspace[];
  isFormbricksCloud: boolean;
}

export const ApiKeyList = async ({
  organizationId,
  locale,
  workspaces,
  isFormbricksCloud,
}: ApiKeyListProps) => {
  const apiKeys = await getApiKeysWithEnvironmentPermissions(organizationId);

  return (
    <EditAPIKeys
      organizationId={organizationId}
      apiKeys={apiKeys}
      locale={locale}
      workspaces={workspaces}
      isFormbricksCloud={isFormbricksCloud}
    />
  );
};
